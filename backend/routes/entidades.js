const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');
const { normalizarRut, formatearRut, validarRut } = require('../lib/rut');
const { exigirCuentasDeEmpresa } = require('../services/validaciones');

const manejarErrorTipado = (err, res, logMsg, msg500) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error({ err }, logMsg);
    return res.status(500).json({ error: msg500 });
};

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const bulkFilaSchema = z.object({
    rut: z.string().min(3).max(20),
    razonSocial: z.string().min(2).max(200),
    cuentaId: z.string().min(1).optional().nullable(),
});

const bulkSchema = z.object({
    empresaId: z.string().min(1),
    tipo: z.enum(['cliente', 'proveedor', 'honorario', 'ambos']).default('proveedor'),
    filas: z.array(bulkFilaSchema).min(1).max(500),
});

const entidadSchema = z.object({
    id: z.string().min(1).optional(),
    rut: z.string().min(3).max(20),
    razonSocial: z.string().min(2).max(200),
    giro: z.string().max(200).optional().nullable(),
    direccion: z.string().max(200).optional().nullable(),
    comuna: z.string().max(100).optional().nullable(),
    ciudad: z.string().max(100).optional().nullable(),
    email: z.string().email().max(200).optional().nullable().or(z.literal('')),
    tipo: z.enum(['cliente', 'proveedor', 'honorario', 'ambos']).default('ambos'),
    cuentaDefaultId: z.string().min(1).optional().nullable(),
    empresaId: z.string().min(1).optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { tipo, busqueda, empresaId: qEmpresaId } = req.query;
        const empresaId = qEmpresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const where = { activo: true };
        if (tipo) where.tipo = tipo;
        if (empresaId) where.empresaId = empresaId;
        if (busqueda) {
            where.OR = [
                { rutNormalizado: { contains: normalizarRut(busqueda) } },
                { razonSocial: { contains: busqueda, mode: 'insensitive' } },
            ];
        }
        const [total, entidades] = await Promise.all([
            prisma.entidad.count({ where }),
            prisma.entidad.findMany({ where, orderBy: [{ razonSocial: 'asc' }], skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(entidades, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo entidades');
        res.status(500).json({ error: 'Error al obtener entidades' });
    }
});

// POST hace upsert por (rut, empresaId) — la identidad real de una entidad,
// igual que ya se hizo para Cuenta: dos documentos (o dos usuarios) del
// mismo RUT no deben crear dos filas distintas, sino reutilizar/actualizar
// la misma para que la cuenta corriente quede en un solo lugar.
router.post('/', authenticateToken, writeLimiter, validate(entidadSchema), async (req, res) => {
    try {
        const { id, ...data } = req.body;
        const empresaId = data.empresaId ?? null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        if (data.email === '') data.email = null;

        await exigirCuentasDeEmpresa(prisma, empresaId, [data.cuentaDefaultId]);
        const rutNormalizado = normalizarRut(data.rut);
        data.rut = formatearRut(data.rut);

        const existente = await prisma.entidad.findFirst({
            where: { rutNormalizado, empresaId },
            select: { id: true },
        });

        let entidad;
        if (existente) {
            entidad = await prisma.entidad.update({
                where: { id: existente.id },
                data: { ...data, rutNormalizado, activo: true },
            });
        } else {
            const idOcupado = id ? await prisma.entidad.findUnique({ where: { id }, select: { id: true } }) : null;
            const entidadId = (id && !idOcupado) ? id : require('crypto').randomUUID();
            entidad = await prisma.entidad.create({ data: { id: entidadId, ...data, rutNormalizado } });
        }
        await auditLog(req.usuario.id, 'CREAR', 'Entidad', entidad.id, { rut: entidad.rut, razonSocial: entidad.razonSocial }, req.ip, req.headers['user-agent']);
        res.status(201).json(entidad);
    } catch (err) {
        manejarErrorTipado(err, res, 'Error creando entidad', 'Error al crear entidad');
    }
});

// Carga masiva: pega varias filas (rut, razon social, cuenta contable) de
// una vez -- pensado para dar de alta o reasignar la cuenta de muchos
// proveedores juntos. Mismo upsert por rutNormalizado que el POST de
// arriba (no importa si el rut viene con puntos o sin puntos), fila por
// fila e independiente: una fila con error no bota a las demas.
router.post('/bulk', authenticateToken, writeLimiter, validate(bulkSchema), async (req, res) => {
    const { empresaId, tipo, filas } = req.body;
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    const resultados = [];
    for (const fila of filas) {
        try {
            if (!validarRut(fila.rut)) {
                resultados.push({ rut: fila.rut, razonSocial: fila.razonSocial, ok: false, error: 'RUT inválido' });
                continue;
            }
            let cuenta = null;
            if (fila.cuentaId) {
                cuenta = await prisma.cuenta.findFirst({ where: { id: fila.cuentaId, empresaId, activo: true } });
                if (!cuenta) {
                    resultados.push({ rut: fila.rut, razonSocial: fila.razonSocial, ok: false, error: 'La cuenta contable no existe en esta empresa' });
                    continue;
                }
            }
            const rutNormalizado = normalizarRut(fila.rut);
            const rutFormateado = formatearRut(fila.rut);
            const existente = await prisma.entidad.findFirst({ where: { rutNormalizado, empresaId } });
            let entidad;
            if (existente) {
                entidad = await prisma.entidad.update({
                    where: { id: existente.id },
                    data: {
                        razonSocial: fila.razonSocial,
                        rut: rutFormateado,
                        activo: true,
                        ...(cuenta ? { cuentaDefaultId: cuenta.id } : {}),
                    },
                });
            } else {
                entidad = await prisma.entidad.create({
                    data: {
                        id: require('crypto').randomUUID(),
                        rut: rutFormateado,
                        rutNormalizado,
                        razonSocial: fila.razonSocial,
                        tipo,
                        cuentaDefaultId: cuenta?.id || null,
                        empresaId,
                    },
                });
            }
            resultados.push({ rut: rutFormateado, razonSocial: entidad.razonSocial, ok: true, actualizado: Boolean(existente) });
        } catch (err) {
            logger.error({ err, fila }, 'Error en fila de carga masiva de entidades');
            resultados.push({ rut: fila.rut, razonSocial: fila.razonSocial, ok: false, error: 'Error interno' });
        }
    }
    await auditLog(req.usuario.id, 'CREAR', 'Entidad', 'bulk', { total: filas.length, ok: resultados.filter(r => r.ok).length }, req.ip, req.headers['user-agent']);
    res.json({ resultados });
});

router.put('/:id', authenticateToken, writeLimiter, validate(entidadSchema.partial()), async (req, res) => {
    try {
        const actual = await prisma.entidad.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Entidad no encontrada' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        const data = { ...req.body };
        if ('empresaId' in data && data.empresaId !== actual.empresaId) return res.status(400).json({ error: 'No se puede cambiar la empresa de una entidad' });
        delete data.empresaId;
        if (data.email === '') data.email = null;
        await exigirCuentasDeEmpresa(prisma, actual.empresaId, [data.cuentaDefaultId]);
        if (data.rut) {
            data.rutNormalizado = normalizarRut(data.rut);
            data.rut = formatearRut(data.rut);
        }
        const entidad = await prisma.entidad.update({ where: { id: req.params.id }, data });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Entidad', entidad.id, req.body, req.ip, req.headers['user-agent']);
        res.json(entidad);
    } catch (err) {
        manejarErrorTipado(err, res, 'Error actualizando entidad', 'Error al actualizar entidad');
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const actual = await prisma.entidad.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Entidad no encontrada' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        await prisma.entidad.update({ where: { id: req.params.id }, data: { activo: false } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Entidad', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Entidad desactivada' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando entidad');
        res.status(500).json({ error: 'Error al eliminar entidad' });
    }
});

module.exports = router;
