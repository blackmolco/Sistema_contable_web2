const { Router } = require('express');
const { prisma, logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');

const router = Router();

// Solo admins pueden listar y gestionar usuarios
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden ver los usuarios' });
        }
        const usuarios = await prisma.usuario.findMany({
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                empresaId: true,
                activo: true,
                ultimoAcceso: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(usuarios);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo usuarios');
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Activar / desactivar usuario
router.patch('/:id/activo', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden modificar usuarios' });
        }
        if (req.params.id === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
        }
        const { activo } = req.body;
        const usuario = await prisma.usuario.update({
            where: { id: req.params.id },
            data: { activo: Boolean(activo) },
            select: { id: true, nombre: true, email: true, activo: true },
        });
        res.json(usuario);
    } catch (err) {
        logger.error({ err }, 'Error actualizando usuario');
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

module.exports = router;
