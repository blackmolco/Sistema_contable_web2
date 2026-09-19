const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { validarRut } = require('../lib/rut');
const { requireRole } = require('../middlewares/requireRole');
const { esAdmin } = require('../middlewares/empresaAccess');
const { CODIGOS_REMUNERACIONES, CAMPO_CONFIG_POR_CONCEPTO } = require('../services/generarAsiento');
const { exigirCuentasDeEmpresa } = require('../services/validaciones');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const empresaSchema = z.object({
    id: z.string().optional(),
    rut: z.string().min(9),
    razonSocial: z.string().min(2).max(200),
    nombreFantasia: z.string().max(200).optional().nullable(),
    giro: z.string().max(200).optional().nullable(),
    direccion: z.string().max(300).optional().nullable(),
    comuna: z.string().max(100).optional().nullable(),
    ciudad: z.string().max(100).optional().nullable(),
    telefono: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
    representanteLegal: z.string().max(200).optional().nullable(),
    rutRepresentante: z.string().max(12).optional().nullable(),
    logo: z.string().optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const where = { activo: true };
        if (!esAdmin(req.usuario)) {
            if (!req.usuario.empresaId) return res.json([]);
            where.id = req.usuario.empresaId;
        }
        const empresas = await prisma.empresa.findMany({ where, orderBy: { razonSocial: 'asc' } });
        res.json(empresas);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo empresas');
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
});

router.post('/', authenticateToken, requireRole('admin', 'administrador'), writeLimiter, validate(empresaSchema), async (req, res) => {
    try {
        if (!validarRut(req.body.rut)) {
            return res.status(400).json({ error: 'RUT invalido' });
        }
        const { id, ...rest } = req.body;
        if (rest.email === '') rest.email = null;

        // La identidad real de una empresa es su rut (@unique en el schema).
        // Antes se hacia upsert por el id que manda el cliente: un admin
        // podia pasar un id arbitrario y sobrescribir en silencio los datos
        // de OTRA empresa ya existente con ese id, sin ningun aviso.
        const existente = await prisma.empresa.findFirst({ where: { rut: rest.rut }, select: { id: true } });
        let empresa;
        if (existente) {
            empresa = await prisma.empresa.update({ where: { id: existente.id }, data: { ...rest, activo: true } });
        } else {
            const idOcupado = id ? await prisma.empresa.findUnique({ where: { id }, select: { id: true } }) : null;
            const empresaId = (id && !idOcupado) ? id : require('crypto').randomUUID();
            empresa = await prisma.empresa.create({ data: { id: empresaId, ...rest } });
        }
        await auditLog(req.usuario.id, 'CREAR', 'Empresa', empresa.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(empresa);
    } catch (err) {
        logger.error({ err }, 'Error creando empresa');
        res.status(500).json({ error: 'Error al crear empresa' });
    }
});

const mutualSchema = z.object({
    mutualNombre: z.string().max(100).optional().nullable(),
    // Puntos porcentuales (0.9 = 0,90%) — la tasa real de cada empresa la
    // fija su Mutual segun rubro/siniestralidad, no hay tabla unica.
    mutualTasaPct: z.number().min(0).max(10).optional().nullable(),
});

// Admin global edita la Mutual de cualquier empresa; un supervisor solo la
// de su propia empresa (es config de "administrador de su empresa", igual
// que Usuarios/Periodos/Auditoria — ver middlewares/empresaAccess.js).
router.patch('/:id/mutual', authenticateToken, writeLimiter, validate(mutualSchema), async (req, res) => {
    try {
        const esAdminGlobal = req.usuario.rol === 'admin' || req.usuario.rol === 'administrador';
        const esSupervisorDeEsta = req.usuario.rol === 'supervisor' && req.usuario.empresaId === req.params.id;
        if (!esAdminGlobal && !esSupervisorDeEsta) {
            return res.status(403).json({ error: 'No tiene permiso para editar la Mutual de esta empresa' });
        }
        const empresa = await prisma.empresa.update({ where: { id: req.params.id }, data: req.body });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Empresa', empresa.id, { mutual: req.body }, req.ip, req.headers['user-agent']);
        res.json(empresa);
    } catch (err) {
        logger.error({ err }, 'Error actualizando Mutual de la empresa');
        res.status(500).json({ error: 'Error al actualizar la Mutual' });
    }
});

// Etiquetas legibles para cada concepto de la centralizacion de
// remuneraciones — ver services/generarAsiento.js (CODIGOS_REMUNERACIONES).
const LABELS_REMUNERACIONES = {
    remuneracionesGasto: 'Sueldos y Salarios (gasto)',
    cotizacionesGasto: 'Cotizaciones Previsionales Empleador (gasto)',
    remuneracionesPorPagar: 'Sueldos Líquidos por Pagar',
    imposicionesPorPagar: 'AFP por Pagar',
    saludPorPagar: 'Salud por Pagar (Fonasa/Isapre)',
    cesantiaPorPagar: 'Seguro de Cesantía por Pagar',
    impuestoUnicoPorPagar: 'Impuesto Único por Pagar',
    mutualPorPagar: 'Mutual de Seguridad por Pagar',
    reformaPrevisionalPorPagar: 'Reforma Previsional por Pagar (Ley 21.735)',
    deudoresVarios: 'Reverso Anticipos/Préstamos al Personal',
};

function puedeConfigurarCentralizacion(req, empresaId) {
    return esAdmin(req.usuario) || (req.usuario.rol === 'supervisor' && req.usuario.empresaId === empresaId);
}

// Muestra, por cada concepto, la cuenta que se va a usar al centralizar:
// la personalizada si existe, si no la que resuelve el codigo por defecto
// (o null si esa tampoco existe en el plan de cuentas de esta empresa).
router.get('/:id/cuentas-remuneraciones', authenticateToken, async (req, res) => {
    try {
        if (!esAdmin(req.usuario) && req.usuario.empresaId !== req.params.id) {
            return res.status(403).json({ error: 'No tiene acceso a esta empresa' });
        }
        const [config, cuentasPorDefecto] = await Promise.all([
            prisma.configCentralizacionRemuneraciones.findUnique({ where: { empresaId: req.params.id } }),
            prisma.cuenta.findMany({ where: { empresaId: req.params.id, codigo: { in: Object.values(CODIGOS_REMUNERACIONES) }, activo: true } }),
        ]);
        const porCodigo = Object.fromEntries(cuentasPorDefecto.map(c => [c.codigo, c]));

        const personalizadasIds = Object.values(CAMPO_CONFIG_POR_CONCEPTO)
            .map(campo => config?.[campo]).filter(Boolean);
        const cuentasPersonalizadas = personalizadasIds.length
            ? await prisma.cuenta.findMany({ where: { id: { in: personalizadasIds }, empresaId: req.params.id, activo: true } })
            : [];
        const personalizadaPorId = Object.fromEntries(cuentasPersonalizadas.map(c => [c.id, c]));

        const resultado = Object.entries(CODIGOS_REMUNERACIONES).map(([concepto, codigoDefault]) => {
            const campoConfig = CAMPO_CONFIG_POR_CONCEPTO[concepto];
            const idPersonalizado = config?.[campoConfig];
            const cuentaPersonalizada = idPersonalizado ? personalizadaPorId[idPersonalizado] : null;
            const cuenta = cuentaPersonalizada || porCodigo[codigoDefault] || null;
            return {
                concepto,
                label: LABELS_REMUNERACIONES[concepto],
                codigoDefault,
                cuentaId: cuenta?.id ?? null,
                cuentaCodigo: cuenta?.codigo ?? null,
                cuentaNombre: cuenta?.nombre ?? null,
                esPersonalizada: Boolean(cuentaPersonalizada),
            };
        });
        res.json(resultado);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo cuentas de centralización de remuneraciones');
        res.status(500).json({ error: 'Error al obtener la configuración' });
    }
});

const cuentasRemuneracionesSchema = z.object(
    Object.fromEntries(Object.keys(CODIGOS_REMUNERACIONES).map(concepto => [concepto, z.string().min(1).nullable().optional()]))
);

// Guarda, concepto por concepto, que cuenta usar al centralizar en vez del
// codigo fijo por defecto. null en un concepto = volver a usar el codigo
// por defecto para ese concepto.
router.patch('/:id/cuentas-remuneraciones', authenticateToken, writeLimiter, validate(cuentasRemuneracionesSchema), async (req, res) => {
    try {
        if (!puedeConfigurarCentralizacion(req, req.params.id)) {
            return res.status(403).json({ error: 'No tiene permiso para configurar la centralización de esta empresa' });
        }
        const data = {};
        for (const [concepto, cuentaId] of Object.entries(req.body)) {
            if (cuentaId === undefined) continue;
            data[CAMPO_CONFIG_POR_CONCEPTO[concepto]] = cuentaId;
        }
        await exigirCuentasDeEmpresa(prisma, req.params.id, Object.values(data));
        const config = await prisma.configCentralizacionRemuneraciones.upsert({
            where: { empresaId: req.params.id },
            create: { empresaId: req.params.id, ...data },
            update: data,
        });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'ConfigCentralizacionRemuneraciones', req.params.id, req.body, req.ip, req.headers['user-agent']);
        res.json(config);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error({ err }, 'Error guardando cuentas de centralización de remuneraciones');
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});

router.delete('/:id', authenticateToken, requireRole('admin', 'administrador'), writeLimiter, async (req, res) => {
    try {
        await prisma.empresa.update({ where: { id: req.params.id }, data: { activo: false } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Empresa', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Empresa desactivada' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando empresa');
        res.status(500).json({ error: 'Error al eliminar empresa' });
    }
});

module.exports = router;

