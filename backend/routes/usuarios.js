const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { sendEmail } = require('../email');

const router = Router();

const actualizarUsuarioSchema = z.object({
    rol: z.enum(['admin', 'contador', 'usuario']).optional(),
    empresaId: z.string().min(1).nullable().optional(),
});

const cambiarPasswordAdminSchema = z.object({
    password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

const ROL_LABEL = { admin: 'Administrador', administrador: 'Administrador', contador: 'Contador', usuario: 'Usuario' };

async function notificarUsuario(usuario, asunto, mensaje) {
    const resultado = await sendEmail({
        to: usuario.email,
        subject: `[Sistema Contable] ${asunto}`,
        text: mensaje,
    });
    if (!resultado.sent) {
        logger.warn({ usuarioId: usuario.id, email: usuario.email, reason: resultado.reason }, 'No se pudo notificar por correo al usuario');
    }
}

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

        const empresa = usuario.empresaId ? await prisma.empresa.findUnique({ where: { id: usuario.empresaId } }) : null;
        const empresaTexto = usuario.rol === 'admin' ? 'todas las empresas' : (empresa ? empresa.razonSocial : 'sin empresa asignada');
        notificarUsuario(usuario, 'Se actualizó tu acceso',
            `Hola ${usuario.nombre},\n\nUn administrador actualizó tu acceso al sistema contable:\n` +
            `- Rol: ${ROL_LABEL[usuario.rol] || usuario.rol}\n- Empresa: ${empresaTexto}\n\n` +
            `Si no esperabas este cambio, contacta a tu administrador.`
        ).catch(err => logger.error({ err }, 'Error notificando cambio de acceso'));

        res.json(usuario);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error actualizando usuario');
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Cambiar la contraseña de un usuario (solo administradores)
router.patch('/:id/password', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'administrador') {
            return res.status(403).json({ error: 'Solo administradores pueden cambiar contraseñas' });
        }
        const { password } = cambiarPasswordAdminSchema.parse(req.body);

        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.usuario.update({ where: { id: objetivo.id }, data: { passwordHash } });
        // La sesión activa del usuario queda invalidada: debe entrar con la clave nueva.
        await prisma.sesion.deleteMany({ where: { usuarioId: objetivo.id } });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Usuario', objetivo.id, { accion: 'cambio_password_por_admin' }, req.ip, req.headers['user-agent']);

        notificarUsuario(objetivo, 'Tu contraseña fue actualizada',
            `Hola ${objetivo.nombre},\n\nUn administrador cambió tu contraseña de acceso al sistema contable.\n\n` +
            `Nueva contraseña: ${password}\n\n` +
            `Te recomendamos cambiarla por una propia apenas ingreses. Si no esperabas este cambio, contacta a tu administrador.`
        ).catch(err => logger.error({ err }, 'Error notificando cambio de contraseña'));

        res.json({ id: objetivo.id, email: objetivo.email });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error cambiando contraseña de usuario');
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
});

module.exports = router;
