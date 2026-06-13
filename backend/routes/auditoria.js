const { Router } = require('express');
const { prisma, logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/requireRole');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');

const router = Router();

router.get('/', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { entidad, usuarioId, desde, hasta } = req.query;
        const where = {};
        if (entidad) where.entidad = entidad;
        if (usuarioId) where.usuarioId = usuarioId;
        if (desde || hasta) {
            where.fecha = {};
            if (desde) where.fecha.gte = new Date(desde);
            if (hasta) where.fecha.lte = new Date(hasta);
        }
        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: { usuario: { select: { nombre: true, email: true } } },
                orderBy: { fecha: 'desc' },
                skip: offset,
                take: limit,
            }),
        ]);
        res.json(paginatedResponse(logs, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error obteniendo audit logs');
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

module.exports = router;
