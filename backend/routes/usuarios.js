const { Router } = require('express');
const { z } = require('zod');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');

const router = Router();

const actualizarUsuarioSchema = z.object({
    rol: z.enum(['admin', 'contador', 'usuario']).optional(),
    empresaId: z.string().min(1).nullable().optional(),
});

// Solo admins pueden listar y gestionar usuarios
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'administrador') {
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
                fechaCreacion: true,
            },
            orderBy: { fechaCreacion: 'asc' },
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
        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'administrador') {
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

// Cambiar rol y/o empresa asignada de un usuario existente
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'administrador') {
            return res.status(403).json({ error: 'Solo administradores pueden modificar usuarios' });
        }
        const datos = actualizarUsuarioSchema.parse(req.body);
        if (datos.rol === undefined && datos.empresaId === undefined) {
            return res.status(400).json({ error: 'No hay cambios que aplicar' });
        }

        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (req.params.id === req.usuario.id && datos.rol && datos.rol !== 'admin') {
            return res.status(400).json({ error: 'No puedes quitarte tu propio rol de administrador' });
        }

        if (datos.empresaId) {
            const empresa = await prisma.empresa.findUnique({ where: { id: datos.empresaId } });
            if (!empresa) return res.status(400).json({ error: 'La empresa indicada no existe' });
        }

        const nuevoRol = datos.rol ?? objetivo.rol;
        // Un administrador ve todas las empresas igual — empresaId no aplica.
        const nuevaEmpresaId = nuevoRol === 'admin' ? null : (datos.empresaId !== undefined ? datos.empresaId : objetivo.empresaId);

        const usuario = await prisma.usuario.update({
            where: { id: req.params.id },
            data: { rol: nuevoRol, empresaId: nuevaEmpresaId },
            select: { id: true, nombre: true, email: true, rol: true, empresaId: true, activo: true },
        });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Usuario', usuario.id, { rol: usuario.rol, empresaId: usuario.empresaId }, req.ip, req.headers['user-agent']);
        res.json(usuario);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error actualizando usuario');
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

module.exports = router;
