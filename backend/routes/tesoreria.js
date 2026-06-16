const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const tesoreriaSchema = z.object({
    fecha: z.string().date(),
    tipo: z.enum(['entrada', 'salida']),
    categoria: z.string().max(100),
    descripcion: z.string().max(500),
    monto: z.number().positive(),
    origen: z.enum(['factura', 'honorario', 'arriendo', 'sueldo', 'proveedor', 'impuesto', 'otro']),
    estado: z.enum(['proyectado', 'confirmado', 'realizado']).default('proyectado'),
    empresaId: z.string().uuid().optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, tipo, estado, desde, hasta } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (tipo) where.tipo = tipo;
        if (estado) where.estado = estado;
        if (desde || hasta) {
            where.fecha = {};
            if (desde) where.fecha.gte = new Date(desde);
            if (hasta) where.fecha.lte = new Date(hasta);
        }
        const [total, movimientos] = await Promise.all([
            prisma.tesoreriaMovimiento.count({ where }),
            prisma.tesoreriaMovimiento.findMany({ where, orderBy: [{ fecha: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(movimientos, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo tesoreria');
        res.status(500).json({ error: 'Error al obtener movimientos de tesoreria' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(tesoreriaSchema), async (req, res) => {
    try {
        const mov = await prisma.tesoreriaMovimiento.create({ data: { ...req.body, fecha: new Date(req.body.fecha) } });
        await auditLog(req.usuario.id, 'CREAR', 'TesoreriaMovimiento', mov.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(mov);
    } catch (err) {
        logger.error({ err }, 'Error creando movimiento tesoreria');
        res.status(500).json({ error: 'Error al crear movimiento' });
    }
});

module.exports = router;

