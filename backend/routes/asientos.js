const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const router = Router();

/**
 * @swagger
 * /api/asientos:
 *   get:
 *     summary: Listar asientos contables
 *     tags: [Asientos]
 *     parameters:
 *       - in: query
 *         name: empresaId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [pendiente, contabilizado, anulado] }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Lista de asientos contables
 *       401:
 *         description: No autorizado
 */
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 60,
    message: { error: 'Limite de operaciones alcanzado' },
});

const detalleAsientoSchema = z.object({
    cuentaId: z.string().min(1).optional().nullable(),
    cuentaCodigo: z.string().max(50).optional().nullable(),
    cuentaNombre: z.string().max(200).optional().nullable(),
    debe: z.number().min(0).default(0),
    haber: z.number().min(0).default(0),
    glosa: z.string().max(500).optional().nullable(),
});

const asientoSchema = z.object({
    id: z.string().min(1).optional(),
    numero: z.number().int().positive(),
    fecha: z.string().datetime().or(z.string().date()),
    glosa: z.string().min(2).max(1000),
    estado: z.enum(['pendiente', 'contabilizado', 'anulado']).default('pendiente'),
    tipo: z.string().max(50).optional().nullable(),
    detalles: z.array(detalleAsientoSchema).min(1),
    empresaId: z.string().min(1).optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, estado, desde, hasta } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (estado) where.estado = estado;
        if (desde || hasta) {
            where.fecha = {};
            if (desde) where.fecha.gte = new Date(desde);
            if (hasta) where.fecha.lte = new Date(hasta);
        }
        const [total, asientos] = await Promise.all([
            prisma.asientoContable.count({ where }),
            prisma.asientoContable.findMany({
                where,
                include: { detalles: true },
                orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
                skip: offset,
                take: limit,
            }),
        ]);
        res.json(paginatedResponse(asientos, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo asientos');
        res.status(500).json({ error: 'Error al obtener asientos' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(asientoSchema), async (req, res) => {
    try {
        const { id, detalles, ...asientoData } = req.body;
        const asientoId = id || require('crypto').randomUUID();
        const totalDebe = detalles.reduce((sum, d) => sum + d.debe, 0);
        const totalHaber = detalles.reduce((sum, d) => sum + d.haber, 0);
        if (Math.abs(totalDebe - totalHaber) > 0.01) {
            return res.status(400).json({ error: 'El asiento no esta cuadrado', totalDebe, totalHaber, diferencia: totalDebe - totalHaber });
        }
        // Delete existing detalles if upserting
        await prisma.detalleAsiento.deleteMany({ where: { asientoId } });
        const asiento = await prisma.asientoContable.upsert({
            where: { id: asientoId },
            create: {
                id: asientoId,
                ...asientoData,
                fecha: new Date(asientoData.fecha),
                usuarioId: req.usuario.id,
                detalles: { create: detalles.map(d => ({ ...d })) },
            },
            update: {
                ...asientoData,
                fecha: new Date(asientoData.fecha),
                detalles: { create: detalles.map(d => ({ ...d })) },
            },
            include: { detalles: true },
        });
        await auditLog(req.usuario.id, 'CREAR', 'AsientoContable', asiento.id, { numero: asiento.numero, totalDebe, totalHaber }, req.ip, req.headers['user-agent']);
        res.status(201).json(asiento);
    } catch (err) {
        logger.error({ err }, 'Error creando asiento');
        res.status(500).json({ error: 'Error al crear asiento' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const { estado } = req.body;
        const asiento = await prisma.asientoContable.update({
            where: { id: req.params.id },
            data: { estado },
            include: { detalles: true },
        });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'AsientoContable', asiento.id, { estado }, req.ip, req.headers['user-agent']);
        res.json(asiento);
    } catch (err) {
        logger.error({ err }, 'Error actualizando asiento');
        res.status(500).json({ error: 'Error al actualizar asiento' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        await prisma.asientoContable.delete({ where: { id: req.params.id } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'AsientoContable', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Asiento eliminado' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando asiento');
        res.status(500).json({ error: 'Error al eliminar asiento' });
    }
});

module.exports = router;
