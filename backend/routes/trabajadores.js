const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');
const { calcularLiquidacion } = require('../services/motorRemuneraciones');
const { lineasParaRemuneraciones, crearAsiento } = require('../services/generarAsiento');
const { exigirPeriodoAbierto } = require('../services/periodos');

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
    // Tasa de cotización AFP como fracción (0.1144 = 11.44%), no porcentaje.
    tasaAfp: z.number().min(0).max(0.3).default(0.10),
    isapre: z.string().optional().nullable(),
    // Fonasa (isapre null): se ignora, siempre 7%. Isapre: plan pactado en UF.
    saludPactado: z.number().min(0).default(0),
    afc: z.number().min(0).default(0),
    cargasFamiliares: z.number().int().min(0).default(0),
    tramoAsignacionFamiliar: z.enum(['A', 'B', 'C', 'D']).default('D'),
    cargasSimples: z.number().int().min(0).default(0),
    cargasMaternales: z.number().int().min(0).default(0),
    cargasInvalidez: z.number().int().min(0).default(0),
    tipoTrabajadorPrevired: z.enum(['0', '1', '2', '3', '8']).default('0'),
    cargo: z.string().max(100).optional().nullable(),
    departamento: z.string().max(100).optional().nullable(),
    estado: z.enum(['activo', 'suspendido', 'desvinculado']).default('activo'),
    empresaId: z.string().uuid().optional().nullable(),
});

// Datos de ENTRADA de un período — lo único que cambia mes a mes; todo lo
// previsional/permanente vive en el propio Trabajador (arriba).
const calcularLiquidacionSchema = z.object({
    trabajadorId: z.string().uuid(),
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    diasTrabajados: z.number().min(0).max(31).default(30),
    sueldoBase: z.number().positive().optional(), // si no viene, se usa el del contrato
    bonos: z.number().min(0).default(0),
    aguinaldo: z.number().min(0).default(0),
    horasExtra: z.number().min(0).default(0),
    horasSemanales: z.number().min(1).max(45).optional(),
    colacion: z.number().min(0).optional(),
    movilizacion: z.number().min(0).optional(),
    viaticos: z.number().min(0).default(0),
    anticipos: z.number().min(0).default(0),
    prestamos: z.number().min(0).default(0),
    empresaId: z.string().min(1).optional().nullable(),
});

// === TRABAJADORES ===
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { estado, busqueda } = req.query;
        const empresaId = req.query.empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const where = { empresaId };
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
        if (!exigirAccesoEmpresa(req, res, rest.empresaId)) return;
        const data = {
            ...rest,
            fechaNacimiento: rest.fechaNacimiento ? new Date(rest.fechaNacimiento) : null,
            fechaIngreso: new Date(rest.fechaIngreso),
            fechaTermino: rest.fechaTermino ? new Date(rest.fechaTermino) : null,
        };
        // No es un upsert: Trabajador no tiene una clave natural declarada
        // en el schema (rut no es unico por empresa a nivel de constraint).
        // Antes se hacia upsert por el id que manda el cliente — si ese id
        // ya era el de un trabajador de OTRA empresa, la llamada lo
        // actualizaba directo con los datos nuevos (incluido su empresaId),
        // reasignandolo silenciosamente. Se crea siempre una fila nueva; el
        // id del cliente solo se respeta si esta libre.
        const idOcupado = id ? await prisma.trabajador.findUnique({ where: { id }, select: { id: true } }) : null;
        const trabajadorId = (id && !idOcupado) ? id : require('crypto').randomUUID();
        const trabajador = await prisma.trabajador.create({ data: { id: trabajadorId, ...data } });
        await auditLog(req.usuario.id, 'CREAR', 'Trabajador', trabajador.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(trabajador);
    } catch (err) {
        logger.error({ err }, 'Error creando trabajador');
        res.status(500).json({ error: 'Error al crear trabajador' });
    }
});

router.put('/:id', authenticateToken, writeLimiter, validate(trabajadorSchema.partial()), async (req, res) => {
    try {
        const actual = await prisma.trabajador.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Trabajador no encontrado' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
        const data = { ...req.body };
        if (data.empresaId && data.empresaId !== actual.empresaId) return res.status(400).json({ error: 'No se puede cambiar la empresa de un trabajador' });
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

// Si el trabajador nunca tuvo una liquidacion, se borra de verdad (no queda
// nada que perder). Si ya tiene alguna — aunque sea de un periodo viejo, no
// solo centralizada — borrarlo de verdad haria cascada sobre
// LiquidacionSueldo (onDelete: Cascade) y se perderia ese historial, asi
// que en ese caso se deja como estaba: solo se desvincula (soft delete).
router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const actual = await prisma.trabajador.findUnique({ where: { id: req.params.id }, select: { empresaId: true } });
        if (!actual) return res.status(404).json({ error: 'Trabajador no encontrado' });
        if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;

        const liquidacionesCount = await prisma.liquidacionSueldo.count({ where: { trabajadorId: req.params.id } });
        if (liquidacionesCount === 0) {
            await prisma.trabajador.delete({ where: { id: req.params.id } });
            await auditLog(req.usuario.id, 'ELIMINAR', 'Trabajador', req.params.id, { tipo: 'borrado' }, req.ip, req.headers['user-agent']);
            return res.json({ message: 'Trabajador eliminado', borrado: true });
        }

        await prisma.trabajador.update({ where: { id: req.params.id }, data: { estado: 'desvinculado' } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Trabajador', req.params.id, { tipo: 'desvinculado', liquidacionesCount }, req.ip, req.headers['user-agent']);
        res.json({
            message: `Este trabajador tiene ${liquidacionesCount} liquidación(es) registradas — no se puede eliminar sin perder ese historial. Se marcó como desvinculado en su lugar.`,
            borrado: false,
            liquidacionesCount,
        });
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
        const empresaId = req.query.empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        const where = { trabajador: { empresaId } };
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

// Calcula una liquidación con el motor legal real (antes este endpoint solo
// guardaba montos que el cliente ya mandaba calculados — no habia ninguna
// validacion de que fueran correctos). Se puede recalcular mientras siga
// 'calculada' (no 'pagada' ni ya centralizada); una vez centralizada
// (asientoId seteado) hay que descentralizar primero para tocarla.
router.post('/liquidaciones/calcular', authenticateToken, writeLimiter, validate(calcularLiquidacionSchema), async (req, res) => {
    try {
        const trabajador = await prisma.trabajador.findUnique({ where: { id: req.body.trabajadorId } });
        if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
        if (!exigirAccesoEmpresa(req, res, req.body.empresaId ?? trabajador.empresaId)) return;

        const existente = await prisma.liquidacionSueldo.findUnique({
            where: { trabajadorId_periodo: { trabajadorId: req.body.trabajadorId, periodo: req.body.periodo } },
        });
        if (existente?.asientoId) {
            return res.status(409).json({ error: 'Esta liquidación ya fue centralizada — no se puede recalcular sin descentralizarla primero.' });
        }

        const indices = await prisma.indicePrevisional.findUnique({ where: { periodo: req.body.periodo } });
        if (!indices) {
            return res.status(400).json({ error: `No hay índices previsionales cargados para ${req.body.periodo}. Cárgalos primero.` });
        }

        const empresa = trabajador.empresaId ? await prisma.empresa.findUnique({ where: { id: trabajador.empresaId }, select: { mutualTasaPct: true } }) : null;
        const resultado = calcularLiquidacion(trabajador, req.body, indices, req.body.periodo, { mutualTasaPct: empresa?.mutualTasaPct ?? undefined });
        const liquidacion = await prisma.liquidacionSueldo.upsert({
            where: { trabajadorId_periodo: { trabajadorId: req.body.trabajadorId, periodo: req.body.periodo } },
            create: { trabajadorId: req.body.trabajadorId, periodo: req.body.periodo, ...resultado },
            update: resultado,
            include: { trabajador: true },
        });
        await auditLog(req.usuario.id, 'CREAR', 'LiquidacionSueldo', liquidacion.id, { periodo: liquidacion.periodo, sueldoLiquido: liquidacion.sueldoLiquido }, req.ip, req.headers['user-agent']);
        res.status(201).json(liquidacion);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error({ err }, 'Error calculando liquidacion');
        res.status(500).json({ error: 'Error al calcular la liquidación' });
    }
});

// Borra una liquidación calculada por error, antes de centralizar — una vez
// centralizada (asientoId seteado) hay que descentralizar el período
// primero (libera TODAS las del período, no una sola: el asiento es uno
// solo para todo el período, no se puede tocar a medias).
router.delete('/liquidaciones/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const liquidacion = await prisma.liquidacionSueldo.findUnique({
            where: { id: req.params.id },
            include: { trabajador: { select: { empresaId: true } } },
        });
        if (!liquidacion) return res.status(404).json({ error: 'Liquidación no encontrada' });
        if (!exigirAccesoEmpresa(req, res, liquidacion.trabajador.empresaId)) return;
        if (liquidacion.asientoId) {
            return res.status(409).json({ error: 'Esta liquidación ya está centralizada — descentraliza el período primero para poder borrarla.' });
        }
        await prisma.liquidacionSueldo.delete({ where: { id: req.params.id } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'LiquidacionSueldo', req.params.id, { periodo: liquidacion.periodo }, req.ip, req.headers['user-agent']);
        res.json({ message: 'Liquidación eliminada' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando liquidacion');
        res.status(500).json({ error: 'Error al eliminar la liquidación' });
    }
});

// Centraliza TODAS las liquidaciones no centralizadas de una empresa/período
// en un solo asiento contable — atómico: todo o nada, con numeración segura
// (ver services/generarAsiento.js).
router.post('/liquidaciones/centralizar', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const { empresaId, periodo } = req.body || {};
        if (!empresaId || !periodo) return res.status(400).json({ error: "Faltan 'empresaId' y 'periodo'" });
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;

        const resultado = await prisma.$transaction(async (tx) => {
            await exigirPeriodoAbierto(tx, empresaId, `${periodo}-01`);
            const liquidaciones = await tx.liquidacionSueldo.findMany({
                where: { periodo, asientoId: null, trabajador: { empresaId } },
                include: { trabajador: true },
            });
            if (liquidaciones.length === 0) {
                const err = new Error('No hay liquidaciones pendientes de centralizar para ese período.');
                err.status = 404;
                throw err;
            }
            const detalles = await lineasParaRemuneraciones(tx, empresaId, liquidaciones);
            const asiento = await crearAsiento(tx, {
                empresaId,
                fecha: `${periodo}-01`,
                glosa: `Centralización Remuneraciones ${periodo}`,
                tipo: 'traspaso',
                detalles,
                usuarioId: req.usuario.id,
            });
            await tx.liquidacionSueldo.updateMany({
                where: { id: { in: liquidaciones.map(l => l.id) } },
                data: { asientoId: asiento.id, estado: 'pagada' },
            });
            return asiento;
        });

        await auditLog(req.usuario.id, 'CREAR', 'AsientoContable', resultado.id, { origen: 'centralizacion_remuneraciones', periodo }, req.ip, req.headers['user-agent']);
        res.status(201).json(resultado);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error({ err }, 'Error centralizando remuneraciones');
        res.status(500).json({ error: err.message || 'Error al centralizar remuneraciones' });
    }
});

// Deshace una centralización: anula el asiento (nunca se borra, igual que
// el resto de la app — ver routes/asientos.js) y libera las liquidaciones
// de ese período para que se puedan recalcular y volver a centralizar.
router.post('/liquidaciones/descentralizar', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const { empresaId, periodo } = req.body || {};
        if (!empresaId || !periodo) return res.status(400).json({ error: "Faltan 'empresaId' y 'periodo'" });
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;

        const resultado = await prisma.$transaction(async (tx) => {
            await exigirPeriodoAbierto(tx, empresaId, `${periodo}-01`);
            const liquidaciones = await tx.liquidacionSueldo.findMany({
                where: { periodo, trabajador: { empresaId }, asientoId: { not: null } },
            });
            if (liquidaciones.length === 0) {
                const err = new Error('No hay ninguna centralización de ese período para deshacer.');
                err.status = 404;
                throw err;
            }
            const asientoId = liquidaciones[0].asientoId;
            const asiento = await tx.asientoContable.findUnique({ where: { id: asientoId } });
            if (!asiento || asiento.estado === 'anulado') {
                const err = new Error('El asiento de esa centralización ya está anulado o no existe.');
                err.status = 409;
                throw err;
            }
            await tx.asientoContable.update({ where: { id: asientoId }, data: { estado: 'anulado' } });
            await tx.liquidacionSueldo.updateMany({
                where: { id: { in: liquidaciones.map(l => l.id) } },
                data: { asientoId: null, estado: 'calculada' },
            });
            return { asientoId, liquidacionesLiberadas: liquidaciones.length };
        });

        await auditLog(req.usuario.id, 'ANULAR', 'AsientoContable', resultado.asientoId, { origen: 'descentralizacion_remuneraciones', periodo }, req.ip, req.headers['user-agent']);
        res.json(resultado);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        logger.error({ err }, 'Error descentralizando remuneraciones');
        res.status(500).json({ error: err.message || 'Error al descentralizar remuneraciones' });
    }
});

module.exports = router;

