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

const docTributarioSchema = z.object({
    id: z.string().uuid().optional(),
    tipo: z.enum(['factura', 'factura_exenta', 'boleta', 'nota_credito', 'nota_debito', 'guia_despacho', 'compra']),
    folio: z.number().int().positive(),
    rutEmisor: z.string().min(9),
    rutReceptor: z.string().min(9),
    razonSocialReceptor: z.string().min(2).max(200),
    giroReceptor: z.string().max(200).optional().nullable(),
    fechaEmision: z.string().date(),
    fechaVencimiento: z.string().date().optional().nullable(),
    montoNeto: z.number().min(0),
    iva: z.number().min(0),
    montoExento: z.number().min(0).default(0),
    montoTotal: z.number().positive(),
    estado: z.enum(['emitido', 'recibido', 'pendiente', 'vencido', 'pagado', 'anulado']).default('emitido'),
    tipoTransaccion: z.enum(['venta', 'compra']),
    glosa: z.string().max(500).optional().nullable(),
    empresaId: z.string().uuid().optional().nullable(),
});

const libroCompraSchema = z.object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    fecha: z.string().date(),
    rutProveedor: z.string().min(9),
    razonSocial: z.string().min(2).max(200),
    montoNeto: z.number().min(0),
    montoExento: z.number().min(0).default(0),
    iva: z.number().min(0),
    ivaNoRecuperable: z.number().min(0).default(0),
    montoTotal: z.number().positive(),
    empresaId: z.string().uuid().optional().nullable(),
});

const libroVentaSchema = z.object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    fecha: z.string().date(),
    rutCliente: z.string().min(9),
    razonSocial: z.string().min(2).max(200),
    montoNeto: z.number().min(0),
    montoExento: z.number().min(0).default(0),
    iva: z.number().min(0),
    montoTotal: z.number().positive(),
    empresaId: z.string().uuid().optional().nullable(),
});

// === DOCUMENTOS TRIBUTARIOS ===
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, tipo, estado, tipoTransaccion, desde, hasta } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (tipo) where.tipo = tipo;
        if (estado) where.estado = estado;
        if (tipoTransaccion) where.tipoTransaccion = tipoTransaccion;
        if (desde || hasta) {
            where.fechaEmision = {};
            if (desde) where.fechaEmision.gte = new Date(desde);
            if (hasta) where.fechaEmision.lte = new Date(hasta);
        }
        const [total, docs] = await Promise.all([
            prisma.documentoTributario.count({ where }),
            prisma.documentoTributario.findMany({ where, orderBy: [{ fechaEmision: 'desc' }, { folio: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(docs, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo documentos tributarios');
        res.status(500).json({ error: 'Error al obtener documentos tributarios' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(docTributarioSchema), async (req, res) => {
    try {
        const { id, ...rest } = req.body;
        const docId = id || require('crypto').randomUUID();
        const data = {
            ...rest,
            fechaEmision: new Date(rest.fechaEmision),
            fechaVencimiento: rest.fechaVencimiento ? new Date(rest.fechaVencimiento) : null,
        };
        const doc = await prisma.documentoTributario.upsert({
            where: { id: docId },
            create: { id: docId, ...data },
            update: data,
        });
        await auditLog(req.usuario.id, 'CREAR', 'DocumentoTributario', doc.id, { tipo: doc.tipo, folio: doc.folio }, req.ip, req.headers['user-agent']);
        res.status(201).json(doc);
    } catch (err) {
        logger.error({ err }, 'Error creando documento tributario');
        res.status(500).json({ error: 'Error al crear documento tributario' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const doc = await prisma.documentoTributario.update({ where: { id: req.params.id }, data: req.body });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'DocumentoTributario', doc.id, req.body, req.ip, req.headers['user-agent']);
        res.json(doc);
    } catch (err) {
        logger.error({ err }, 'Error actualizando documento tributario');
        res.status(500).json({ error: 'Error al actualizar documento tributario' });
    }
});

// === LIBRO COMPRAS ===
router.get('/libro-compras', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, periodo } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (periodo) where.periodo = periodo;
        const [total, registros] = await Promise.all([
            prisma.libroCompra.count({ where }),
            prisma.libroCompra.findMany({ where, orderBy: [{ fecha: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(registros, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo libro compras');
        res.status(500).json({ error: 'Error al obtener libro compras' });
    }
});

router.post('/libro-compras', authenticateToken, writeLimiter, validate(libroCompraSchema), async (req, res) => {
    try {
        const registro = await prisma.libroCompra.create({ data: { ...req.body, fecha: new Date(req.body.fecha) } });
        await auditLog(req.usuario.id, 'CREAR', 'LibroCompra', registro.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(registro);
    } catch (err) {
        logger.error({ err }, 'Error creando registro libro compras');
        res.status(500).json({ error: 'Error al crear registro' });
    }
});

// === LIBRO VENTAS ===
router.get('/libro-ventas', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, periodo } = req.query;
        const where = {};
        if (empresaId) where.empresaId = empresaId;
        if (periodo) where.periodo = periodo;
        const [total, registros] = await Promise.all([
            prisma.libroVenta.count({ where }),
            prisma.libroVenta.findMany({ where, orderBy: [{ fecha: 'desc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(registros, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo libro ventas');
        res.status(500).json({ error: 'Error al obtener libro ventas' });
    }
});

router.post('/libro-ventas', authenticateToken, writeLimiter, validate(libroVentaSchema), async (req, res) => {
    try {
        const registro = await prisma.libroVenta.create({ data: { ...req.body, fecha: new Date(req.body.fecha) } });
        await auditLog(req.usuario.id, 'CREAR', 'LibroVenta', registro.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(registro);
    } catch (err) {
        logger.error({ err }, 'Error creando registro libro ventas');
        res.status(500).json({ error: 'Error al crear registro' });
    }
});

module.exports = router;

