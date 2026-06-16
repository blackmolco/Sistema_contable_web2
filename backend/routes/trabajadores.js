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

const trabajadorSchema = z.object({
    id: z.string().uuid().optional(),
    rut: z.string().min(9).max(12),
    nombres: z.string().min(2).max(100),
    apellidos: z.string().min(2).max(100),
    email: z.string().email().optional().nullable(),
    fechaNacimiento: z.string().date().optional().nullable(),
    fechaIngreso: z.string().date(),
    fechaTermino: z.string().date().optional().nullable(),
    tipoContrato: z.enum(['indefinido', 'plazo_fijo', 'por_obra', 'honorarios', 'practica']),
    sueldoBase: z.number().positive(),
    colacion: z.number().min(0).default(0),
    movilizacion: z.number().min(0).default(0),
    bonificacion: z.number().min(0).default(0),
    afp: z.string().min(2),
    isapre: z.string().optional().nullable(),
    saludPactado: z.number().min(0).max(10).default(7),
    afc: z.number().min(0).default(0),
    cargasFamiliares: z.number().int().min(0).default(0),
    cargo: z.string().max(100).optional().nullable(),
    departamento: z.string().max(100).optional().nullable(),
    estado: z.enum(['activo', 'suspendido', 'desvinculado']).default('activo'),
    empresaId: z.string().uuid().optional().nullable(),
});

const liquidacionSchema = z.object({
    trabajadorId: z.string().uuid(),
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    sueldoBase: z.number().positive(),
    bonos: z.number().min(0).default(0),
    horasExtras: z.number().min(0).default(0),
    montoHorasExtras: z.number().min(0).default(0),
    gratificacion: z.number().min(0).default(0),
    descuentoAFP: z.number().min(0),
    descuentoSalud: z.number().min(0),
    descuentoAFC: z.number().min(0).default(0),
    descuentoImpuesto: z.number().min(0),
    otrosDescuentos: z.number().min(0).default(0),
    asignacionFamiliar: z.number().min(0).default(0),
    estado: z.enum(['calculada', 'pagada', 'anulada']).default('calculada'),
    fechaPago: z.string().date().optional().nullable(),
    ufValor: z.number().optional().nullable(),
    utmValor: z.number().optional().nullable(),
});

// === TRABAJADORES ===
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, estado, busqueda } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (estado) where.estado = estado;
        if (busqueda) {
            where.OR = [
                { nombres: { contains: busqueda } },
                { apellidos: { contains: busqueda } },
                { rut: { contains: busqueda } },
            ];
        }
        const [total, trabajadores] = await Promise.all([
            prisma.trabajador.count({ where }),
            prisma.trabajador.findMany({ where, orderBy: [{ apellidos: 'asc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(trabajadores, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo trabajadores');
        res.status(500).json({ error: 'Error al obtener trabajadores' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(trabajadorSchema), async (req, res) => {
    try {
        const { id, ...rest } = req.body;
        const trabajadorId = id || require('crypto').randomUUID();
        const data = {
            ...rest,
            fechaNacimiento: rest.fechaNacimiento ? new Date(rest.fechaNacimiento) : null,
            fechaIngreso: new Date(rest.fechaIngreso),
            fechaTermino: rest.fechaTermino ? new Date(rest.fechaTermino) : null,
        };
        const trabajador = await prisma.trabajador.upsert({
            where: { id: trabajadorId },
            create: { id: trabajadorId, ...data },
            update: data,
        });
        await auditLog(req.usuario.id, 'CREAR', 'Trabajador', trabajador.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(trabajador);
    } catch (err) {
        logger.error({ err }, 'Error creando trabajador');
        res.status(500).json({ error: 'Error al crear trabajador' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, validate(trabajadorSchema.partial()), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.fechaNacimiento) data.fechaNacimiento = new Date(data.fechaNacimiento);
        if (data.fechaIngreso) data.fechaIngreso = new Date(data.fechaIngreso);
        if (data.fechaTermino) data.fechaTermino = new Date(data.fechaTermino);
        const trabajador = await prisma.trabajador.update({ where: { id: req.params.id }, data });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Trabajador', trabajador.id, req.body, req.ip, req.headers['user-agent']);
        res.json(trabajador);
    } catch (err) {
        logger.error({ err }, 'Error actualizando trabajador');
        res.status(500).json({ error: 'Error al actualizar trabajador' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        await prisma.trabajador.update({ where: { id: req.params.id }, data: { estado: 'desvinculado' } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Trabajador', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Trabajador desvinculado' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando trabajador');
        res.status(500).json({ error: 'Error al eliminar trabajador' });
    }
});

// === LIQUIDACIONES ===
router.get('/liquidaciones', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { trabajadorId, periodo } = req.query;
        const where = {};
        if (trabajadorId) where.trabajadorId = trabajadorId;
        if (periodo) where.periodo = periodo;
        const [total, liquidaciones] = await Promise.all([
            prisma.liquidacionSueldo.count({ where }),
            prisma.liquidacionSueldo.findMany({ where, include: { trabajador: true }, orderBy: [{ periodo: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(liquidaciones, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo liquidaciones');
        res.status(500).json({ error: 'Error al obtener liquidaciones' });
    }
});

router.post('/liquidaciones', authenticateToken, writeLimiter, validate(liquidacionSchema), async (req, res) => {
    try {
        const totalImponible = req.body.sueldoBase + req.body.bonos + req.body.montoHorasExtras + req.body.gratificacion;
        const totalDescuentos = req.body.descuentoAFP + req.body.descuentoSalud + req.body.descuentoAFC + req.body.descuentoImpuesto + req.body.otrosDescuentos;
        const sueldoLiquido = totalImponible - totalDescuentos + req.body.asignacionFamiliar;
        const liquidacion = await prisma.liquidacionSueldo.create({
            data: {
                ...req.body,
                totalImponible,
                totalDescuentos,
                sueldoLiquido,
                fechaPago: req.body.fechaPago ? new Date(req.body.fechaPago) : null,
            },
            include: { trabajador: true },
        });
        await auditLog(req.usuario.id, 'CREAR', 'LiquidacionSueldo', liquidacion.id, { periodo: liquidacion.periodo, sueldoLiquido }, req.ip, req.headers['user-agent']);
        res.status(201).json(liquidacion);
    } catch (err) {
        logger.error({ err }, 'Error creando liquidacion');
        res.status(500).json({ error: 'Error al crear liquidacion' });
    }
});

module.exports = router;

