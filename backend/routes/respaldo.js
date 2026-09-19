const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { exigirAccesoEmpresa, esAdmin } = require('../middlewares/empresaAccess');
const { exportarEmpresa } = require('../services/respaldo');

const router = Router();
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Demasiados respaldos en la última hora; intenta más tarde' },
});

// Descarga un respaldo completo (JSON con checksum) de UNA empresa. Solo un
// administrador global o el supervisor de esa empresa.
router.get('/empresa', authenticateToken, limiter, async (req, res) => {
    try {
        const empresaId = String(req.query.empresaId || '');
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const puede = esAdmin(req.usuario) || req.usuario.rol === 'supervisor';
        if (!puede) return res.status(403).json({ error: 'Solo un administrador puede descargar respaldos' });

        const respaldo = await exportarEmpresa(prisma, empresaId);
        await auditLog(req.usuario.id, 'EXPORTAR_RESPALDO', 'Empresa', empresaId, { conteos: respaldo.conteos }, req.ip, req.headers['user-agent']);

        const fecha = respaldo.generadoEn.slice(0, 10);
        const rut = respaldo.empresa.rut.replace(/[^0-9kK]/g, '');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="respaldo_${rut}_${fecha}.json"`);
        res.send(JSON.stringify(respaldo));
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error({ err }, 'Error generando respaldo');
        res.status(500).json({ error: 'No se pudo generar el respaldo' });
    }
});

module.exports = router;
