const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

// Bienes que el SII excluye de la depreciacion instantanea Pro Pyme (14 D N3):
// terrenos e inmuebles. No es exhaustivo (tambien excluye intangibles, que
// este sistema no registra como activo fijo), pero cubre las categorias que
// de hecho se usan en el formulario.
const CATEGORIAS_SIN_INSTANTANEA = new Set(['inmueble', 'terreno']);

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
    // Migracion desde otro sistema: cuanto ya estaba depreciado antes de
    // registrar el bien aqui (solo pista financiera — ver nota abajo).
    depreciacionAcumulada: z.number().min(0).default(0),
    // Depreciacion tributaria (SII), calculada en paralelo a la financiera
    // de arriba — ver nota en schema.prisma. vidaUtilMesesTributaria es
    // obligatoria salvo en 'instantanea' (se ignora: el gasto es 100% el
    // mes de adquisicion).
    metodoTributario: z.enum(['normal', 'acelerada', 'instantanea']).default('normal'),
    vidaUtilMesesTributaria: z.number().int().positive().optional().nullable(),
});

// Calcula ambos juegos de depreciacion (financiera ya se calculaba antes;
// aqui solo se agrega la tributaria) desde los mismos datos de compra.
function calcularDepreciacionTributaria(body) {
    const { metodoTributario, valorAdquisicion, vidaUtilMeses, categoria } = body;
    let { vidaUtilMesesTributaria } = body;

    if (metodoTributario === 'instantanea') {
        if (CATEGORIAS_SIN_INSTANTANEA.has((categoria || '').toLowerCase())) {
            const err = new Error('La depreciacion instantanea no aplica a terrenos ni inmuebles (SII, regimen Pro Pyme 14 D N3).');
            err.status = 400;
            throw err;
        }
        // 100% gasto tributario el mismo mes de adquisicion — no es una
        // tasa mensual, por eso depreciacionMensualTributaria queda en 0 y
        // el "acumulado" es directo el valor de adquisicion completo.
        return { vidaUtilMesesTributaria: 1, depreciacionMensualTributaria: 0, valorNetoTributarioInicial: 0, acumuladaInstantanea: valorAdquisicion };
    }

    if (metodoTributario === 'acelerada') {
        // Vida util acelerada = 1/3 de la normal (Art. 31 N5 LIR), redondeada
        // hacia arriba — si no se especifica, se deriva de la financiera.
        vidaUtilMesesTributaria = vidaUtilMesesTributaria || Math.max(1, Math.ceil(vidaUtilMeses / 3));
    } else {
        // 'normal': si no se especifica una vida util tributaria propia (de
        // la tabla del SII), se asume igual a la financiera — es una
        // aproximacion razonable, no la tabla oficial completa del SII.
        vidaUtilMesesTributaria = vidaUtilMesesTributaria || vidaUtilMeses;
    }

    const depreciacionMensualTributaria = valorAdquisicion / vidaUtilMesesTributaria;
    return { vidaUtilMesesTributaria, depreciacionMensualTributaria, valorNetoTributarioInicial: valorAdquisicion, acumuladaInstantanea: 0 };
}

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const empresaId = req.query.empresaId || req.usuario.empresaId || null;
        const { estado } = req.query;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const where = { empresaId };
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
        if (!exigirAccesoEmpresa(req, res, req.body.empresaId)) return;
        const depreciacionMensual = req.body.valorAdquisicion / req.body.vidaUtilMeses;
        const trib = calcularDepreciacionTributaria(req.body);
        const activo = await prisma.activoFijo.create({
            data: {
                ...req.body,
                fechaAdquisicion: new Date(req.body.fechaAdquisicion),
                depreciacionMensual,
                valorNeto: req.body.valorAdquisicion - req.body.depreciacionAcumulada,
                vidaUtilMesesTributaria: trib.vidaUtilMesesTributaria,
                depreciacionMensualTributaria: trib.depreciacionMensualTributaria,
                depreciacionAcumuladaTributaria: trib.acumuladaInstantanea,
                valorNetoTributario: trib.valorNetoTributarioInicial,
            },
        });
        await auditLog(req.usuario.id, 'CREAR', 'ActivoFijo', activo.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(activo);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        logger.error({ err }, 'Error creando activo fijo');
        res.status(500).json({ error: 'Error al crear activo fijo' });
    }
});

module.exports = router;

