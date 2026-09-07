// Endpoint transaccional: ingresar un documento (factura, boleta, boleta de
// honorarios, nota de crédito/débito) crea de una sola vez, en una sola
// transacción — nunca por separado con llamadas fire-and-forget como el
// resto de la app — la Entidad (cliente/proveedor/prestador), el documento
// y su asiento contable automático. Todo o nada.
const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { lineasParaDocumento, lineasParaHonorario, crearAsiento } = require('../services/generarAsiento');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const entidadInlineSchema = z.object({
    rut: z.string().min(3).max(20),
    razonSocial: z.string().min(2).max(200),
    giro: z.string().max(200).optional().nullable(),
    direccion: z.string().max(200).optional().nullable(),
    comuna: z.string().max(100).optional().nullable(),
    ciudad: z.string().max(100).optional().nullable(),
    email: z.string().email().max(200).optional().nullable().or(z.literal('')),
});

const ingresoSchema = z.object({
    tipoDocumento: z.enum(['factura', 'factura_exenta', 'boleta', 'boleta_exenta', 'nota_credito', 'nota_debito', 'honorario']),
    tipoTransaccion: z.enum(['venta', 'compra']).optional(),
    folio: z.number().int().positive().optional(),
    fecha: z.string().date(),
    periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    entidad: entidadInlineSchema,
    neto: z.number().min(0).default(0),
    exento: z.number().min(0).default(0),
    iva: z.number().min(0).default(0),
    total: z.number().positive().optional(),
    cuentaGastoId: z.string().min(1).optional().nullable(),
    montoBruto: z.number().min(0).optional(),
    retencion: z.number().min(0).optional(),
    montoLiquido: z.number().min(0).optional(),
    empresaId: z.string().min(1).optional().nullable(),
});

router.post('/', authenticateToken, writeLimiter, validate(ingresoSchema), async (req, res) => {
    const body = req.body;
    const empresaId = body.empresaId ?? null;
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            // 1) Upsert de la entidad por (rut, empresaId) — mismo patron que Cuenta.
            const entidadData = { ...body.entidad, empresaId };
            if (entidadData.email === '') entidadData.email = null;
            let entidad = await tx.entidad.findFirst({ where: { rut: entidadData.rut, empresaId } });
            if (entidad) {
                entidad = await tx.entidad.update({ where: { id: entidad.id }, data: { ...entidadData, activo: true } });
            } else {
                entidad = await tx.entidad.create({
                    data: {
                        id: require('crypto').randomUUID(),
                        ...entidadData,
                        tipo: body.tipoDocumento === 'honorario' ? 'honorario' : (body.tipoTransaccion === 'compra' ? 'proveedor' : 'cliente'),
                    },
                });
            }

            // 2) Boleta de honorarios: modelo propio.
            if (body.tipoDocumento === 'honorario') {
                if (body.montoBruto == null || body.retencion == null || body.montoLiquido == null || !body.periodo) {
                    throw Object.assign(new Error('Faltan montoBruto/retencion/montoLiquido/periodo para la boleta de honorarios'), { status: 400 });
                }
                const honorarioId = require('crypto').randomUUID();
                const honorario = await tx.honorario.create({
                    data: {
                        id: honorarioId,
                        rut: entidad.rut,
                        nombre: entidad.razonSocial,
                        direccion: entidad.direccion || null,
                        periodo: body.periodo,
                        montoBruto: body.montoBruto,
                        retencion: body.retencion,
                        montoLiquido: body.montoLiquido,
                        estado: 'pendiente',
                        empresaId,
                    },
                });
                const detalles = await lineasParaHonorario(tx, empresaId, {
                    montoBruto: body.montoBruto,
                    retencion: body.retencion,
                    montoLiquido: body.montoLiquido,
                    entidad,
                    documentoId: honorario.id,
                });
                const asiento = await crearAsiento(tx, {
                    empresaId,
                    fecha: body.fecha,
                    glosa: `Boleta de honorarios ${entidad.razonSocial} — ${body.periodo}`,
                    tipo: 'honorario',
                    detalles,
                    usuarioId: req.usuario.id,
                });
                const honorarioConAsiento = await tx.honorario.update({ where: { id: honorario.id }, data: { asientoId: asiento.id } });
                return { entidad, documento: honorarioConAsiento, asiento };
            }

            // 3) Documento tributario (factura/boleta/NC/ND).
            if (!body.tipoTransaccion || !body.folio || body.total == null) {
                throw Object.assign(new Error('Faltan tipoTransaccion/folio/total para el documento'), { status: 400 });
            }
            if (body.tipoTransaccion === 'compra' && (body.neto || 0) + (body.exento || 0) > 0 && !body.cuentaGastoId) {
                throw Object.assign(new Error('Debe elegir la cuenta de gasto/activo para esta compra'), { status: 400 });
            }

            // rutEmisor/rutReceptor siguen la misma convencion ya usada en toda
            // la app (SincronizacionSII, Facturacion, LibroVentas): rutEmisor
            // es siempre el RUT de la propia empresa y rutReceptor siempre el
            // de la contraparte, sea cliente o proveedor — no se invierte
            // segun direccion, para no romper el codigo que ya lee
            // doc.receptor.rut / d.rutReceptor como "la otra parte".
            const empresa = empresaId ? await tx.empresa.findUnique({ where: { id: empresaId }, select: { rut: true } }) : null;
            const documentoId = require('crypto').randomUUID();
            const documento = await tx.documentoTributario.create({
                data: {
                    id: documentoId,
                    tipo: body.tipoDocumento,
                    folio: body.folio,
                    rutEmisor: empresa?.rut || '',
                    rutReceptor: entidad.rut,
                    razonSocialReceptor: entidad.razonSocial,
                    giroReceptor: entidad.giro || null,
                    direccionReceptor: entidad.direccion || null,
                    comunaReceptor: entidad.comuna || null,
                    fechaEmision: new Date(body.fecha),
                    montoNeto: body.neto,
                    iva: body.iva,
                    montoExento: body.exento,
                    montoTotal: body.total,
                    estado: body.tipoTransaccion === 'compra' ? 'pendiente' : 'emitido',
                    tipoTransaccion: body.tipoTransaccion,
                    empresaId,
                },
            });

            const detalles = await lineasParaDocumento(tx, empresaId, {
                tipo: body.tipoDocumento,
                tipoTransaccion: body.tipoTransaccion,
                neto: body.neto,
                exento: body.exento,
                iva: body.iva,
                total: body.total,
                cuentaGastoId: body.cuentaGastoId,
                entidad,
                documentoId: documento.id,
            });
            const asiento = await crearAsiento(tx, {
                empresaId,
                fecha: body.fecha,
                glosa: `${body.tipoDocumento} N° ${body.folio} — ${entidad.razonSocial}`,
                tipo: body.tipoTransaccion,
                detalles,
                usuarioId: req.usuario.id,
            });
            const documentoConAsiento = await tx.documentoTributario.update({ where: { id: documento.id }, data: { asientoId: asiento.id } });
            return { entidad, documento: documentoConAsiento, asiento };
        }, { timeout: 15000 });
        // timeout mas holgado que el default (5s): el numero correlativo se
        // asigna con un UPDATE que se serializa a nivel de fila en Postgres,
        // asi que si llegan varias solicitudes casi juntas para la misma
        // empresa, las siguientes esperan a que la anterior termine — con el
        // default eso alcanzaba a expirar la transaccion bajo rafagas.

        await auditLog(req.usuario.id, 'CREAR', 'IngresoDocumento', resultado.asiento.id, { tipoDocumento: body.tipoDocumento, numeroAsiento: resultado.asiento.numero }, req.ip, req.headers['user-agent']);
        res.status(201).json(resultado);
    } catch (err) {
        if (err.status === 400) {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Ya existe un documento con ese folio para esta empresa' });
        }
        logger.error({ err }, 'Error en ingreso de documento');
        res.status(500).json({ error: err.message || 'Error al ingresar el documento' });
    }
});

module.exports = router;
