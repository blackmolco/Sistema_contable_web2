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
        const { id, ...rest } = req.body;
        if (rest.email === '') rest.email = null;
        const empresaId = id || require('crypto').randomUUID();
        const empresa = await prisma.empresa.upsert({
            where: { id: empresaId },
            create: { id: empresaId, ...rest },
            update: rest,
        });
        await auditLog(req.usuario.id, 'CREAR', 'Empresa', empresa.id, req.body, req.ip, req.headers['user-agent']);
        res.status(201).json(empresa);
    } catch (err) {
        logger.error({ err }, 'Error creando empresa');
        res.status(500).json({ error: 'Error al crear empresa' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
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

