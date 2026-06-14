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

const cuentaSchema = z.object({
    id: z.string().uuid().optional(),
    codigo: z.string().min(1).max(20),
    nombre: z.string().min(2).max(200),
    tipo: z.enum(['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo']),
    naturaleza: z.enum(['deudora', 'acreedora']).default('deudora'),
    nivel: z.number().int().min(1).max(5).default(1),
    padreId: z.string().uuid().optional().nullable(),
    afectaIva: z.boolean().default(false),
    descripcion: z.string().max(500).optional().nullable(),
    refSII: z.string().max(50).optional().nullable(),
    permiteMovimiento: z.boolean().default(true),
    empresaId: z.string().uuid().optional().nullable(),
});

/**
 * @swagger
 * /api/cuentas:
 *   get:
 *     summary: Listar plan de cuentas
 *     tags: [Cuentas]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [activo, pasivo, patrimonio, ingreso, gasto, costo] }
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Lista de cuentas contables
 *       401:
 *         description: No autorizado
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { tipo, busqueda, empresaId: qEmpresaId } = req.query;
        const empresaId = qEmpresaId || req.usuario.empresaId || null;
        const where = { activo: true };
        if (tipo) where.tipo = tipo;
        if (empresaId) where.empresaId = empresaId;
        if (busqueda) {
            where.OR = [
                { codigo: { contains: busqueda } },
                { nombre: { contains: busqueda } },
            ];
        }
        const [total, cuentas] = await Promise.all([
            prisma.cuenta.count({ where }),
            prisma.cuenta.findMany({ where, orderBy: [{ codigo: 'asc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(cuentas, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo cuentas');
        res.status(500).json({ error: 'Error al obtener cuentas' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(cuentaSchema), async (req, res) => {
    try {
        const { id, ...data } = req.body;
        const cuentaId = id || require('crypto').randomUUID();
        const cuenta = await prisma.cuenta.upsert({
            where: { id: cuentaId },
            create: { id: cuentaId, ...data },
            update: data,
        });
        await auditLog(req.usuario.id, 'CREAR', 'Cuenta', cuenta.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(cuenta);
    } catch (err) {
        logger.error({ err }, 'Error creando cuenta');
        res.status(500).json({ error: 'Error al crear cuenta' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, validate(cuentaSchema.partial()), async (req, res) => {
    try {
        const cuenta = await prisma.cuenta.update({ where: { id: req.params.id }, data: req.body });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Cuenta', cuenta.id, req.body, req.ip, req.headers['user-agent']);
        res.json(cuenta);
    } catch (err) {
        logger.error({ err }, 'Error actualizando cuenta');
        res.status(500).json({ error: 'Error al actualizar cuenta' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        await prisma.cuenta.update({ where: { id: req.params.id }, data: { activo: false } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Cuenta', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Cuenta desactivada' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando cuenta');
        res.status(500).json({ error: 'Error al eliminar cuenta' });
    }
});

module.exports = router;
