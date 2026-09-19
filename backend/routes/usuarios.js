const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { sendEmail } = require('../email');

const router = Router();

const actualizarUsuarioSchema = z.object({
    rol: z.enum(['admin', 'supervisor', 'contador', 'usuario']).optional(),
    empresaId: z.string().min(1).nullable().optional(),
});

const cambiarPasswordAdminSchema = z.object({
    password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

const editarPerfilSchema = z.object({
    nombre: z.string().min(2).max(200).optional(),
    email: z.string().email().optional(),
});

const ROL_LABEL = { admin: 'Administrador', administrador: 'Administrador', supervisor: 'Supervisor', contador: 'Contador', usuario: 'Usuario' };

// Admin global (ve todas las empresas) vs Supervisor (admin de SU empresa,
// ver nota en gestionarUsuarios abajo).
function esAdminGlobal(rol) {
    return rol === 'admin' || rol === 'administrador';
}

// Un supervisor administra usuarios, pero solo los de su propia empresa, y
// nunca puede crear/ascender a alguien a admin o supervisor (evitaria que
// se autoescale a superadmin o cree otro supervisor a su antojo). Esas dos
// reglas se aplican en cada endpoint de abajo, no solo en el gate de entrada.
function puedeGestionarUsuarios(rol) {
    return esAdminGlobal(rol) || rol === 'supervisor';
}

// Un supervisor solo puede tocar usuarios de SU MISMA empresa, y nunca uno
// que ya sea admin o supervisor (evita que se ataque entre supervisores o
// se le quite el acceso a un admin global). Devuelve el mensaje de error si
// la operación no está permitida, o null si puede seguir.
function errorSiSupervisorNoPuede(req, objetivo) {
    if (esAdminGlobal(req.usuario.rol)) return null; // admin global no tiene restricciones
    if (!req.usuario.empresaId) return 'Su usuario no tiene una empresa asignada';
    if (objetivo.empresaId !== req.usuario.empresaId) return 'No tiene acceso a ese usuario';
    if (objetivo.rol !== 'contador' && objetivo.rol !== 'usuario') return 'No puede modificar una cuenta de administrador o supervisor';
    return null;
}

async function notificarUsuario(usuario, asunto, mensaje) {
    const resultado = await sendEmail({
        to: usuario.email,
        subject: `[Sistema Contable] ${asunto}`,
        text: mensaje,
    });
    if (!resultado.sent) {
        logger.warn({ usuarioId: usuario.id, email: usuario.email, reason: resultado.reason }, 'No se pudo notificar por correo al usuario');
    }
    return resultado;
}

// Admin global ve todos los usuarios; supervisor solo los de su propia
// empresa (nunca los de otros clientes ni los de otras empresas).
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para ver los usuarios' });
        }
        const where = esAdminGlobal(req.usuario.rol) ? {} : { empresaId: req.usuario.empresaId };
        const usuarios = await prisma.usuario.findMany({
            where,
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
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para modificar usuarios' });
        }
        if (req.params.id === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
        }
        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: { empresaId: true, rol: true } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
        const errorSupervisor = errorSiSupervisorNoPuede(req, objetivo);
        if (errorSupervisor) return res.status(403).json({ error: errorSupervisor });
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
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para modificar usuarios' });
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

        const errorSupervisor = errorSiSupervisorNoPuede(req, objetivo);
        if (errorSupervisor) return res.status(403).json({ error: errorSupervisor });
        if (!esAdminGlobal(req.usuario.rol)) {
            // Un supervisor no puede ascender a nadie a admin/supervisor (se
            // autoescalaría o crearía otro supervisor a su antojo) ni mover
            // al usuario a otra empresa — solo alternar contador <-> usuario
            // dentro de su propia empresa.
            if (datos.rol && datos.rol !== 'contador' && datos.rol !== 'usuario') {
                return res.status(403).json({ error: 'No puede asignar ese rol' });
            }
            if (datos.empresaId !== undefined && datos.empresaId !== req.usuario.empresaId) {
                return res.status(403).json({ error: 'No puede asignar usuarios a otra empresa' });
            }
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
        const correo = await notificarUsuario(usuario, 'Se actualizó tu acceso',
            `Hola ${usuario.nombre},\n\nUn administrador actualizó tu acceso al sistema contable:\n` +
            `- Rol: ${ROL_LABEL[usuario.rol] || usuario.rol}\n- Empresa: ${empresaTexto}\n\n` +
            `Si no esperabas este cambio, contacta a tu administrador.`
        ).catch(err => { logger.error({ err }, 'Error notificando cambio de acceso'); return { sent: false, reason: err.message }; });

        res.json({ ...usuario, emailEnviado: correo.sent, emailError: correo.sent ? undefined : correo.reason });
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
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para cambiar contraseñas' });
        }
        const { password } = cambiarPasswordAdminSchema.parse(req.body);

        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
        const errorSupervisor = errorSiSupervisorNoPuede(req, objetivo);
        if (errorSupervisor) return res.status(403).json({ error: errorSupervisor });

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.usuario.update({ where: { id: objetivo.id }, data: { passwordHash } });
        // La sesión activa del usuario queda invalidada: debe entrar con la clave nueva.
        await prisma.sesion.deleteMany({ where: { usuarioId: objetivo.id } });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Usuario', objetivo.id, { accion: 'cambio_password_por_admin' }, req.ip, req.headers['user-agent']);

        const correo = await notificarUsuario(objetivo, 'Tu contraseña fue actualizada',
            `Hola ${objetivo.nombre},\n\nUn administrador cambió tu contraseña de acceso al sistema contable.\n\n` +
            `Nueva contraseña: ${password}\n\n` +
            `Te recomendamos cambiarla por una propia apenas ingreses. Si no esperabas este cambio, contacta a tu administrador.`
        ).catch(err => { logger.error({ err }, 'Error notificando cambio de contraseña'); return { sent: false, reason: err.message }; });

        res.json({ id: objetivo.id, email: objetivo.email, emailEnviado: correo.sent, emailError: correo.sent ? undefined : correo.reason });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error cambiando contraseña de usuario');
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
});

// Cambiar nombre y/o email de un usuario existente
router.patch('/:id/perfil', authenticateToken, async (req, res) => {
    try {
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para modificar usuarios' });
        }
        const datos = editarPerfilSchema.parse(req.body);
        if (datos.nombre === undefined && datos.email === undefined) {
            return res.status(400).json({ error: 'No hay cambios que aplicar' });
        }
        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
        const errorSupervisor = errorSiSupervisorNoPuede(req, objetivo);
        if (errorSupervisor) return res.status(403).json({ error: errorSupervisor });

        if (datos.email && datos.email !== objetivo.email) {
            const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
            if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
        }

        const usuario = await prisma.usuario.update({
            where: { id: req.params.id },
            data: datos,
            select: { id: true, nombre: true, email: true, rol: true, empresaId: true, activo: true },
        });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Usuario', usuario.id, { perfil: datos }, req.ip, req.headers['user-agent']);

        const correo = datos.email
            ? await notificarUsuario(usuario, 'Tu correo de acceso fue actualizado',
                `Hola ${usuario.nombre},\n\nTu correo de acceso al sistema contable cambió a: ${usuario.email}\n\n` +
                `Si no esperabas este cambio, contacta a tu administrador.`
              ).catch(err => { logger.error({ err }, 'Error notificando cambio de correo'); return { sent: false, reason: err.message }; })
            : { sent: true };

        res.json({ ...usuario, emailEnviado: correo.sent, emailError: correo.sent ? undefined : correo.reason });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error editando perfil de usuario');
        res.status(500).json({ error: 'Error al editar el usuario' });
    }
});

// Si el usuario nunca genero actividad (ningun asiento/documento/log a su
// nombre), se borra de verdad. Si ya genero algo, borrarlo de verdad
// rompería esa trazabilidad (los asientos quedarían sin autor) — se
// desactiva en su lugar, igual que se hace con un Trabajador que ya tiene
// liquidaciones (ver routes/trabajadores.js).
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!puedeGestionarUsuarios(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permiso para eliminar usuarios' });
        }
        if (req.params.id === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }
        const objetivo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
        if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
        const errorSupervisor = errorSiSupervisorNoPuede(req, objetivo);
        if (errorSupervisor) return res.status(403).json({ error: errorSupervisor });

        const [asientos, documentos, logs] = await Promise.all([
            prisma.asientoContable.count({ where: { usuarioId: req.params.id } }),
            prisma.documento.count({ where: { usuarioId: req.params.id } }),
            prisma.auditLog.count({ where: { usuarioId: req.params.id } }),
        ]);

        if (asientos + documentos + logs === 0) {
            await prisma.sesion.deleteMany({ where: { usuarioId: req.params.id } });
            await prisma.usuario.delete({ where: { id: req.params.id } });
            await auditLog(req.usuario.id, 'ELIMINAR', 'Usuario', req.params.id, { tipo: 'borrado' }, req.ip, req.headers['user-agent']);
            return res.json({ message: 'Usuario eliminado', borrado: true });
        }

        await prisma.usuario.update({ where: { id: req.params.id }, data: { activo: false } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Usuario', req.params.id, { tipo: 'desactivado', asientos, documentos, logs }, req.ip, req.headers['user-agent']);
        res.json({
            message: `Este usuario ya generó actividad en el sistema (${asientos} asiento(s), ${documentos} documento(s), ${logs} registro(s) de auditoría) — no se puede eliminar sin perder esa trazabilidad. Se desactivó en su lugar.`,
            borrado: false,
        });
    } catch (err) {
        logger.error({ err }, 'Error eliminando usuario');
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
});

module.exports = router;
