const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { exigirAccesoEmpresa, esAdmin } = require('../middlewares/empresaAccess');
const { lineasParaDocumento, crearAsiento } = require('../services/generarAsiento');
const { exigirPeriodoAbierto } = require('../services/periodos');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const docTributarioSchema = z.object({
    id: z.string().min(1).optional(),
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
    empresaId: z.string().min(1).optional().nullable(),
    documentoReferenciaId: z.string().min(1).optional().nullable(),
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
    empresaId: z.string().min(1).optional().nullable(),
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
    empresaId: z.string().min(1).optional().nullable(),
});

// === DOCUMENTOS TRIBUTARIOS ===
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { tipo, estado, tipoTransaccion, desde, hasta } = req.query;
        const empresaId = req.query.empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const where = { empresaId };
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
        if (!exigirAccesoEmpresa(req, res, rest.empresaId)) return;
        const data = {
            ...rest,
            fechaEmision: new Date(rest.fechaEmision),
            fechaVencimiento: rest.fechaVencimiento ? new Date(rest.fechaVencimiento) : null,
        };
        const empresaId = data.empresaId ?? null;

        // La identidad real de un documento es (tipo, folio, tipoTransaccion,
        // empresaId) — asi lo declara el unique del schema. Antes se
        // intentaba primero un upsert por el id que manda el cliente, y solo
        // se caia a buscar por la clave natural si chocaba el unique (P2002)
        // — eso significaba que un id de otra empresa (visto antes, o de un
        // form viejo) actualizaba esa fila ajena directamente, sin pasar
        // nunca por el chequeo de clave natural. Mismo patron ya corregido
        // en cuentas.js/entidades.js.
        const existente = await prisma.documentoTributario.findFirst({
            where: { tipo: data.tipo, folio: data.folio, tipoTransaccion: data.tipoTransaccion, empresaId },
            select: { id: true },
        });

        let doc;
        if (existente) {
            doc = await prisma.documentoTributario.update({ where: { id: existente.id }, data });
        } else {
            const idOcupado = id ? await prisma.documentoTributario.findUnique({ where: { id }, select: { id: true } }) : null;
            const docId = (id && !idOcupado) ? id : require('crypto').randomUUID();
            doc = await prisma.documentoTributario.create({ data: { id: docId, ...data } });
        }
        await auditLog(req.usuario.id, 'CREAR', 'DocumentoTributario', doc.id, { tipo: doc.tipo, folio: doc.folio }, req.ip, req.headers['user-agent']);
        res.status(201).json(doc);
    } catch (err) {
        logger.error({ err }, 'Error creando documento tributario');
        res.status(500).json({ error: 'Error al crear documento tributario' });
    }
});

// Completa un documento antiguo que fue cargado sin asiento. Mantiene el
// documento original y solo agrega el asiento contable faltante.
router.post('/:id/contabilizar', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const actual = await prisma.documentoTributario.findUnique({ where: { id: req.params.id } });
        if (!actual) return res.status(404).json({ error: 'Documento no encontrado' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        if (actual.estado === 'anulado') return res.status(409).json({ error: 'No se puede contabilizar un documento anulado' });
        if (actual.asientoId) {
            const asientoExistente = await prisma.asientoContable.findUnique({
                where: { id: actual.asientoId },
                include: { detalles: true },
            });
            if (asientoExistente) return res.json({ documento: actual, asiento: asientoExistente, yaExistia: true });
        }

        const cuentaGastoId = typeof req.body?.cuentaGastoId === 'string' ? req.body.cuentaGastoId : undefined;
        const cuentaIngresoId = typeof req.body?.cuentaIngresoId === 'string' ? req.body.cuentaIngresoId : undefined;
        const resultado = await prisma.$transaction(async (tx) => {
            await exigirPeriodoAbierto(tx, actual.empresaId, actual.fechaEmision.toISOString().slice(0, 10));
            const entidadRut = actual.rutReceptor || 'SIN-RUT';
            // Algunos datos históricos guardan el mismo RUT con puntos o
            // espacios. Buscar por la versión normalizada evita intentar
            // crear una entidad equivalente y chocar con el índice único.
            const entidadesEmpresa = await tx.entidad.findMany({ where: { empresaId: actual.empresaId } });
            const rutNormalizado = entidadRut.replace(/[^0-9kK]/g, '').toUpperCase();
            let entidad = entidadesEmpresa.find(e => e.rut.replace(/[^0-9kK]/g, '').toUpperCase() === rutNormalizado);
            if (!entidad) {
                entidad = await tx.entidad.create({
                    data: {
                        id: require('crypto').randomUUID(),
                        rut: entidadRut,
                        razonSocial: actual.razonSocialReceptor || 'Sin nombre',
                        giro: actual.giroReceptor || null,
                        direccion: actual.direccionReceptor || null,
                        tipo: actual.tipoTransaccion === 'compra' ? 'proveedor' : 'cliente',
                        empresaId: actual.empresaId,
                    },
                });
            }
            const detalles = await lineasParaDocumento(tx, actual.empresaId, {
                tipo: actual.tipo,
                tipoTransaccion: actual.tipoTransaccion,
                neto: actual.montoNeto,
                exento: actual.montoExento,
                iva: actual.iva,
                total: actual.montoTotal,
                cuentaGastoId,
                cuentaIngresoId,
                entidad,
                documentoId: actual.id,
            });
            const asiento = await crearAsiento(tx, {
                empresaId: actual.empresaId,
                fecha: actual.fechaEmision,
                glosa: `${actual.tipo} N° ${actual.folio} — ${actual.razonSocialReceptor}`,
                tipo: actual.tipoTransaccion,
                detalles,
                usuarioId: req.usuario.id,
                importacionId: actual.importacionId,
            });
            const documento = await tx.documentoTributario.update({
                where: { id: actual.id },
                data: { asientoId: asiento.id, estado: actual.tipoTransaccion === 'compra' ? 'recibido' : 'emitido' },
            });
            return { documento, asiento };
        }, { timeout: 15000 });
        await auditLog(req.usuario.id, 'CONTABILIZAR', 'DocumentoTributario', actual.id, { asientoId: resultado.asiento.id }, req.ip, req.headers['user-agent']);
        res.status(201).json(resultado);
    } catch (err) {
        logger.error({ err }, 'Error contabilizando documento pendiente');
        if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un asiento o entidad equivalente para este documento. Actualice la pantalla e intente nuevamente.' });
        // err.status marca un error de negocio controlado (ej. "Falta la
        // cuenta X en el plan de cuentas") cuyo mensaje es seguro de
        // mostrar. Sin eso, es una excepcion inesperada (Prisma, TypeError,
        // etc.) y su .message no deberia llegar al cliente tal cual.
        if (err.status) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Error contabilizando documento' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, validate(docTributarioSchema.partial()), async (req, res) => {
    try {
        const actual = await prisma.documentoTributario.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Documento no encontrado' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        // req.body ya pasó por validate(): solo trae las columnas declaradas
        // en docTributarioSchema, con sus tipos correctos. Antes se pasaba
        // req.body directo a Prisma sin ningun filtro ni chequeo de tipos —
        // cualquier usuario con acceso a la empresa podia escribir CUALQUIER
        // columna del documento (asientoId, folio, montoTotal, etc.) con
        // cualquier valor.
        const { id, empresaId: _empresaId, ...data } = req.body;
        if (req.body.empresaId && req.body.empresaId !== actual.empresaId) return res.status(400).json({ error: 'No se puede cambiar la empresa de un documento' });
        if (data.fechaEmision) data.fechaEmision = new Date(data.fechaEmision);
        if (data.fechaVencimiento !== undefined) data.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
        const doc = await prisma.documentoTributario.update({ where: { id: req.params.id }, data });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'DocumentoTributario', doc.id, data, req.ip, req.headers['user-agent']);
        res.json(doc);
    } catch (err) {
        logger.error({ err }, 'Error actualizando documento tributario');
        res.status(500).json({ error: 'Error al actualizar documento tributario' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const actual = await prisma.documentoTributario.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Documento no encontrado' });
        // Registros antiguos creados antes de activar el aislamiento por empresa
        // pueden tener empresaId nulo. El administrador puede limpiarlos sin
        // abrir acceso a usuarios normales ni afectar otra empresa.
        if (actual.empresaId) {
            if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        } else if (!esAdmin(req.usuario)) {
            return res.status(403).json({ error: 'Solo un administrador puede eliminar un documento sin empresa asociada' });
        }
        await prisma.documentoTributario.delete({ where: { id: req.params.id } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'DocumentoTributario', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Documento eliminado' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando documento tributario');
        res.status(500).json({ error: 'Error al eliminar documento tributario' });
    }
});

// === LIBRO COMPRAS ===
router.get('/libro-compras', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { empresaId, periodo } = req.query;
        const empresaSeleccionada = empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaSeleccionada)) return;
        const where = { empresaId: empresaSeleccionada };
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
        if (!exigirAccesoEmpresa(req, res, req.body.empresaId)) return;
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
        const empresaSeleccionada = empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaSeleccionada)) return;
        const where = { empresaId: empresaSeleccionada };
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
        if (!exigirAccesoEmpresa(req, res, req.body.empresaId)) return;
        const registro = await prisma.libroVenta.create({ data: { ...req.body, fecha: new Date(req.body.fecha) } });
        await auditLog(req.usuario.id, 'CREAR', 'LibroVenta', registro.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(registro);
    } catch (err) {
        logger.error({ err }, 'Error creando registro libro ventas');
        res.status(500).json({ error: 'Error al crear registro' });
    }
});

module.exports = router;
