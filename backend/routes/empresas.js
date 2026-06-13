const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { validarRut } = require('../lib/rut');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 60,
    message: { error: 'Limite de operaciones alcanzado' },
});

const empresaSchema = z.object({
    rut: z.string().min(9),
    razonSocial: z.string().min(2).max(200),
    nombreFantasia: z.string().max(200).optional().nullable(),
    giro: z.string().max(200).optional().nullable(),
    direccion: z.string().max(300).optional().nullable(),
    comuna: z.string().max(100).optional().nullable(),
    ciudad: z.string().max(100).optional().nullable(),
    telefono: z.string().max(50).optional().nullable(),
    email: z.string().email().optional().nullable(),
    representanteLegal: z.string().max(200).optional().nullable(),
    rutRepresentante: z.string().max(12).optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({ where: { activo: true }, orderBy: { razonSocial: 'asc' } });
        res.json(empresas);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo empresas');
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
});

router.post('/', authenticateToken, writeLimiter, validate(empresaSchema), async (req, res) => {
    try {
        if (!validarRut(req.body.rut)) {
            return res.status(400).json({ error: 'RUT invalido' });
        }
        const empresa = await prisma.empresa.create({ data: req.body });
        await auditLog(req.usuario.id, 'CREAR', 'Empresa', empresa.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(empresa);
    } catch (err) {
        logger.error({ err }, 'Error creando empresa');
        res.status(500).json({ error: 'Error al crear empresa' });
    }
});

module.exports = router;
