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
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 60,
    message: { error: 'Limite de operaciones alcanzado' },
});

const activoFijoSchema = z.object({
    codigo: z.string().min(1).max(50),
    descripcion: z.string().min(2).max(500),
    categoria: z.string().max(100),
    fechaAdquisicion: z.string().date(),
    valorAdquisicion: z.number().positive(),
    vidaUtilMeses: z.number().int().positive(),
    ubicacion: z.string().max(200).optional().nullable(),
    estado: z.enum(['activo', 'vendido', 'dado_baja']).default('activo'),
    empresaId: z.string().uuid().optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, estado } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (estado) where.estado = estado;
        const [total, activos] = await Promise.all([
            prisma.activoFijo.count({ where }),
            prisma.activoFijo.findMany({ where, orderBy: [{ fechaAdquisicion: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(activos, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo activos fijos');
        res.status(500).json({ error: 'Error al obtener activos fijos' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(activoFijoSchema), async (req, res) => {
    try {
        const depreciacionMensual = req.body.valorAdquisicion / req.body.vidaUtilMeses;
        const activo = await prisma.activoFijo.create({
            data: {
                ...req.body,
                fechaAdquisicion: new Date(req.body.fechaAdquisicion),
                depreciacionMensual,
                valorNeto: req.body.valorAdquisicion,
            },
        });
        await auditLog(req.usuario.id, 'CREAR', 'ActivoFijo', activo.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(activo);
    } catch (err) {
        logger.error({ err }, 'Error creando activo fijo');
        res.status(500).json({ error: 'Error al crear activo fijo' });
    }
});

module.exports = router;
