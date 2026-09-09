const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { validarRut } = require('../lib/rut');
const { requireRole } = require('../middlewares/requireRole');
const { esAdmin } = require('../middlewares/empresaAccess');

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

