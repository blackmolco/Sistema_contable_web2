// Indices previsionales mensuales (UF/UTM/sueldo minimo/topes/tasa SIS) que
// Previred publica cada mes — son NACIONALES, no por empresa, asi que solo
// el administrador global los carga (una vez, sirve para todas las
// empresas). El resto de los roles solo puede leerlos, para poder mostrar
// "aun no se cargan los indices de este mes" en la pantalla de liquidaciones.
const { Router } = require('express');
const { z } = require('zod');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');

const router = Router();

const indiceSchema = z.object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    valorUf: z.number().positive(),
    valorUtm: z.number().positive(),
    sueldoMinimo: z.number().positive(),
    topeAfpSaludUf: z.number().positive().default(90.0),
    topeCesantiaUf: z.number().positive().default(135.2),
    tasaSis: z.number().min(0).max(0.1),
    valorTramoA: z.number().min(0).default(0),
    valorTramoB: z.number().min(0).default(0),
    valorTramoC: z.number().min(0).default(0),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { periodo } = req.query;
        if (periodo) {
            const indice = await prisma.indicePrevisional.findUnique({ where: { periodo: String(periodo) } });
            return res.json(indice || null);
        }
        const indices = await prisma.indicePrevisional.findMany({ orderBy: { periodo: 'desc' }, take: 24 });
        res.json(indices);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo indices previsionales');
        res.status(500).json({ error: 'Error al obtener índices previsionales' });
    }
});

router.post('/', authenticateToken, validate(indiceSchema), async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'administrador') {
            return res.status(403).json({ error: 'Solo el administrador puede cargar los índices previsionales del mes' });
        }
        const { periodo, ...data } = req.body;
        const indice = await prisma.indicePrevisional.upsert({
            where: { periodo },
            create: { periodo, ...data, actualizadoPor: req.usuario.email },
            update: { ...data, actualizadoPor: req.usuario.email },
        });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'IndicePrevisional', periodo, data, req.ip, req.headers['user-agent']);
        res.status(201).json(indice);
    } catch (err) {
        logger.error({ err }, 'Error guardando indices previsionales');
        res.status(500).json({ error: 'Error al guardar índices previsionales' });
    }
});

module.exports = router;
