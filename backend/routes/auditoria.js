const { Router } = require('express');
const { prisma, logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/requireRole');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');

const router = Router();

router.get('/', authenticateToken, requireRole('admin', 'administrador', 'supervisor'), async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { entidad, usuarioId, desde, hasta } = req.query;
        const where = {};
        if (entidad) where.entidad = entidad;
        if (usuarioId) where.usuarioId = usuarioId;
        // El log no guarda empresaId (es polimorfico: entidad/entidadId
        // apuntan a filas de tablas distintas). Un supervisor no ve todas
        // las empresas, asi que se acota a las acciones hechas por usuarios
        // de SU MISMA empresa — no es "cambios sobre registros de mi
        // empresa" al 100%, pero evita que vea actividad de otros clientes.
        if (req.usuario.rol === 'supervisor') {
            where.usuario = { empresaId: req.usuario.empresaId };
        }
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
