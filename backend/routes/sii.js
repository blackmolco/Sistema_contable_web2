const { Router } = require('express');
const { logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/requireRole');
const { validate } = require('../middlewares/validate');
const siiService = require('../siiService');
const { obtenerRCV, convertirADocumentoTributario } = require('../sii-rcv');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const router = Router();

const rcvSyncLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: { error: 'Demasiadas sincronizaciones. Espere 5 minutos.' },
});

const rcvSyncSchema = z.object({
    rut   : z.string().min(9).max(12),
    clave : z.string().min(4),
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    tipo  : z.enum(['ventas', 'compras']),
});

router.get('/semilla', authenticateToken, async (req, res) => {
    try {
        const semilla = await siiService.obtenerSemilla(process.env.SII_API_ENV || 'cert');
        res.json({ success: true, semilla });
    } catch (err) {
        logger.error({ err }, 'Error obteniendo semilla SII');
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/consultar-dte', authenticateToken, async (req, res) => {
    try {
        const { rutEmisor, tipoDte, folio, token } = req.body;
        if (!rutEmisor || !tipoDte || !folio) {
            return res.status(400).json({ error: 'rutEmisor, tipoDte y folio requeridos' });
        }
        const resultado = await siiService.consultarDTE(rutEmisor, tipoDte, folio, token, process.env.SII_API_ENV || 'cert');
        res.json(resultado);
    } catch (err) {
        logger.error({ err }, 'Error consultando DTE');
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/tipos-documento', authenticateToken, async (req, res) => {
    try {
        res.json(siiService.getTiposDocumentoSII());
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo tipos documento' });
    }
});

router.post('/rcv', authenticateToken, rcvSyncLimiter, validate(rcvSyncSchema), async (req, res) => {
    const { rut, clave, periodo, tipo } = req.body;
    logger.info({ rut, periodo, tipo }, 'Solicitud de sincronizacion RCV');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
        const resultado = await obtenerRCV(rut, clave, periodo, tipo);
        const documentos = resultado.documentos.map(d => convertirADocumentoTributario(d, () => uuidv4()));
        logger.info({ count: documentos.length, periodo, tipo }, 'RCV sincronizado OK');
        return res.json({
            success: true,
            documentos,
            total: documentos.length,
            totalMonto: resultado.totalMonto,
            periodo,
            tipo,
            debug: resultado.debug,
        });
    } catch (err) {
        logger.error({ err: err.message, code: err.code }, 'Error en sync RCV');
        const errCode = err.code || 'ERROR_DESCONOCIDO';
        const status = errCode === 'CREDENCIALES_INVALIDAS' ? 401
                     : errCode === 'CAPTCHA' ? 503
                     : errCode === 'PORTAL_CAMBIADO' ? 502
                     : 500;
        return res.status(status).json({
            success: false,
            code: errCode,
            mensaje: err.mensaje || err.message || 'Error al obtener RCV del SII',
        });
    }
});

// ============ RCV ASINCRONO + SSE (MEJORA 9) ============
const jobQueue = require('../jobQueue');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../shared');

// POST /api/sii/rcv/async — encola la sincronizacion y retorna jobId
router.post('/rcv/async', authenticateToken, rcvSyncLimiter, validate(rcvSyncSchema), (req, res) => {
    const { rut, clave, periodo, tipo } = req.body;
    logger.info({ rut, periodo, tipo }, 'Solicitud de sincronizacion RCV (async)');
    const jobId = jobQueue.submit('sii-rcv', async () => {
        const resultado = await obtenerRCV(rut, clave, periodo, tipo);
        const documentos = resultado.documentos.map(d => convertirADocumentoTributario(d, () => uuidv4()));
        return {
            success: true,
            documentos,
            total: documentos.length,
            totalMonto: resultado.totalMonto,
            periodo,
            tipo,
        };
    });
    res.status(202).json({ jobId });
});

// Autentica por header Authorization o por query ?token= (EventSource no envia headers)
function authenticateSse(req, res, next) {
    const headerToken = req.headers['authorization']?.split(' ')[1];
    const token = headerToken || req.query.token;
    if (!token) return res.status(401).json({ error: 'Token de autenticacion requerido' });
    try {
        req.usuario = jwt.verify(token, getJwtSecret());
        next();
    } catch {
        return res.status(403).json({ error: 'Token invalido o expirado' });
    }
}

// GET /api/sii/rcv/stream/:jobId — Server-Sent Events con el estado del job
router.get('/rcv/stream/:jobId', authenticateSse, (req, res) => {
    const { jobId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = () => {
        const status = jobQueue.getStatus(jobId);
        res.write(`data: ${JSON.stringify(status)}\n\n`);
        if (['done', 'failed', 'not_found'].includes(status.status)) {
            clearInterval(interval);
            res.end();
        }
    };
    const interval = setInterval(send, 1000);
    send(); // primer evento inmediato

    req.on('close', () => clearInterval(interval));
});

module.exports = router;
