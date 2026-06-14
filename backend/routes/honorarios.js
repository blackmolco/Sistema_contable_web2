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

const honorarioCreateSchema = z.object({
    id: z.string().uuid().optional(),
    rut: z.string().min(9).max(12),
    nombre: z.string().min(2).max(200),
    direccion: z.string().max(300).optional().nullable(),
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    montoBruto: z.number().positive(),
    retencion: z.number().min(0),
    montoLiquido: z.number().positive(),
    fechaPago: z.string().date().optional().nullable(),
    estado: z.enum(['pendiente', 'pagado', 'anulado']).default('pendiente'),
    empresaId: z.string().uuid().optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, periodo, estado } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (periodo) where.periodo = periodo;
        if (estado) where.estado = estado;
        const [total, honorarios] = await Promise.all([
            prisma.honorario.count({ where }),
            prisma.honorario.findMany({ where, orderBy: [{ periodo: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(honorarios, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo honorarios');
        res.status(500).json({ error: 'Error al obtener honorarios' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(honorarioCreateSchema), async (req, res) => {
    try {
        const { id, ...rest } = req.body;
        const honorarioId = id || require('crypto').randomUUID();
        const data = { ...rest, fechaPago: rest.fechaPago ? new Date(rest.fechaPago) : null };
        const honorario = await prisma.honorario.upsert({
            where: { id: honorarioId },
            create: { id: honorarioId, ...data },
            update: data,
        });
        await auditLog(req.usuario.id, 'CREAR', 'Honorario', honorario.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(honorario);
    } catch (err) {
        logger.error({ err }, 'Error creando honorario');
        res.status(500).json({ error: 'Error al crear honorario' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, validate(honorarioCreateSchema.partial()), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.fechaPago) data.fechaPago = new Date(data.fechaPago);
        const honorario = await prisma.honorario.update({ where: { id: req.params.id }, data });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Honorario', honorario.id, req.body, req.ip, req.headers['user-agent']);
        res.json(honorario);
    } catch (err) {
        logger.error({ err }, 'Error actualizando honorario');
        res.status(500).json({ error: 'Error al actualizar honorario' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        await prisma.honorario.delete({ where: { id: req.params.id } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Honorario', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Honorario eliminado' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando honorario');
        res.status(500).json({ error: 'Error al eliminar honorario' });
    }
});

module.exports = router;
