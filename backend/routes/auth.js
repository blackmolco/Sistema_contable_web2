const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getJwtSecret } = require('../shared');
const crypto = require('crypto');
const { sendEmail } = require('../email');

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;
const RESTABLECER_MINUTOS = 30;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const router = Router();

const authLoginSchema = z.object({
    email: z.string().email('Email invalido'),
    password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

const authRegisterSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email invalido'),
    password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
    rut: z.string().optional().nullable(),
    rol: z.enum(['admin', 'supervisor', 'usuario', 'contador']).default('usuario'),
    empresaId: z.string().optional().nullable(),
});

const changePasswordSchema = z.object({
    passwordActual: z.string().min(1, 'Ingrese su contrasena actual'),
    passwordNuevo: z.string().min(8, 'La contrasena nueva debe tener al menos 8 caracteres'),
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Demasiados intentos. Intente mas tarde.' },
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Login exitoso, retorna JWT
 *       401:
 *         description: Credenciales inválidas
 */
// Admin global crea cualquier usuario en cualquier empresa. Supervisor
// (admin de SU empresa) tambien puede crear, pero acotado: nunca otro
// admin/supervisor, y siempre dentro de su propia empresa — se ignora
// cualquier rol/empresaId distinto que intente mandar en el body.
router.post('/register', authenticateToken, async (req, res) => {
    try {
        const esAdminGlobal = req.usuario.rol === 'admin' || req.usuario.rol === 'administrador';
        const esSupervisor = req.usuario.rol === 'supervisor';
        if (!esAdminGlobal && !esSupervisor) {
            return res.status(403).json({ error: 'No tiene permiso para crear usuarios' });
        }
        const data = authRegisterSchema.parse(req.body);
        if (esSupervisor) {
            if (data.rol !== 'contador' && data.rol !== 'usuario') {
                return res.status(403).json({ error: 'No puede asignar ese rol' });
            }
            if (!req.usuario.empresaId) return res.status(403).json({ error: 'Su usuario no tiene una empresa asignada' });
            data.empresaId = req.usuario.empresaId;
        }
        const existe = await prisma.usuario.findUnique({ where: { email: data.email } });
        if (existe) {
            return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
        }
        const passwordHash = await bcrypt.hash(data.password, 10);
        const usuario = await prisma.usuario.create({
            data: {
                nombre: data.nombre,
                email: data.email,
                passwordHash,
                rut: data.rut || '00.000.000-0',
                rol: data.rol,
                empresaId: data.empresaId ?? null,
                activo: true,
            },
        });
        await auditLog(req.usuario.id, 'CREAR', 'Usuario', usuario.id, { email: usuario.email, rol: usuario.rol }, req.ip, req.headers['user-agent']);
        logger.info({ createdBy: req.usuario.id, newUser: usuario.id }, 'Usuario creado');

        const rolTexto = { admin: 'Administrador', supervisor: 'Supervisor', contador: 'Contador', usuario: 'Usuario' }[usuario.rol] || usuario.rol;
        const empresaTexto = usuario.rol === 'admin' || !usuario.empresaId
            ? (usuario.rol === 'admin' ? 'todas las empresas' : 'sin empresa asignada')
            : (await prisma.empresa.findUnique({ where: { id: usuario.empresaId } }))?.razonSocial || 'sin empresa asignada';
        const correo = await sendEmail({
            to: usuario.email,
            subject: '[Sistema Contable] Se creó tu cuenta',
            text: `Hola ${usuario.nombre},\n\nSe creó tu acceso al sistema contable.\n\n` +
                `Email: ${usuario.email}\nContraseña: ${data.password}\nRol: ${rolTexto}\nEmpresa: ${empresaTexto}\n\n` +
                `Te recomendamos cambiar tu contraseña por una propia apenas ingreses.`,
        }).catch(err => { logger.error({ err }, 'Error enviando correo de bienvenida'); return { sent: false, reason: err.message }; });
        if (!correo.sent) logger.warn({ email: usuario.email, reason: correo.reason }, 'No se pudo enviar correo de bienvenida');

        res.status(201).json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            empresaId: usuario.empresaId,
            emailEnviado: correo.sent,
            emailError: correo.sent ? undefined : correo.reason,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error creando usuario');
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = authLoginSchema.parse(req.body);
        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario || !usuario.activo) {
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }
        // Bloqueo por cuenta: frena la fuerza bruta aunque cambie la IP.
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
            return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente nuevamente en unos minutos o use "Olvidé mi contraseña".' });
        }
        const passwordValid = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValid) {
            const intentos = (usuario.intentosFallidos || 0) + 1;
            const bloquear = intentos >= MAX_INTENTOS;
            await prisma.usuario.update({
                where: { id: usuario.id },
                data: {
                    intentosFallidos: bloquear ? 0 : intentos,
                    bloqueadoHasta: bloquear ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000) : null,
                },
            });
            if (bloquear) await auditLog(usuario.id, 'BLOQUEO_LOGIN', 'Usuario', usuario.id, { intentos: MAX_INTENTOS }, req.ip, req.headers['user-agent']);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }
        const JWT_SECRET = getJwtSecret();
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol, empresaId: usuario.empresaId },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        const refreshToken = jwt.sign(
            { id: usuario.id },
            JWT_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );
        await prisma.sesion.create({
            data: {
                usuarioId: usuario.id,
                token,
                refreshToken,
                fechaExpiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
                ipOrigen: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
        });
        logger.info({ usuarioId: usuario.id, email }, 'Login exitoso');
        res.json({
            token,
            refreshToken,
            user: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rut: usuario.rut,
                rol: usuario.rol,
                empresaId: usuario.empresaId,
            },
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors });
        }
        logger.error({ err }, 'Error en login');
        res.status(500).json({ error: 'Error al iniciar sesion' });
    }
});

router.post('/refresh', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' });
        const JWT_SECRET = getJwtSecret();
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        const sesion = await prisma.sesion.findUnique({ where: { refreshToken } });
        if (!sesion || sesion.fechaExpiracion < new Date()) {
            return res.status(401).json({ error: 'Sesion expirada' });
        }
        const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } });
        if (!usuario || !usuario.activo) {
            await prisma.sesion.delete({ where: { refreshToken } });
            return res.status(401).json({ error: 'Usuario desactivado o no encontrado' });
        }
        const newToken = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol, empresaId: usuario.empresaId },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        res.json({ token: newToken });
    } catch (err) {
        res.status(401).json({ error: 'Refresh token invalido' });
    }
});

// Cambio de contrasena propia — no existia ningun endpoint para esto; sin
// el, rotar una contrasena solo se podia hacer editando la base de datos
// directamente.
router.post('/change-password', authenticateToken, authLimiter, async (req, res) => {
    try {
        const { passwordActual, passwordNuevo } = changePasswordSchema.parse(req.body);
        const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
        if (!usuario || !usuario.activo) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
        if (!valido) {
            return res.status(401).json({ error: 'La contrasena actual no es correcta' });
        }
        const passwordHash = await bcrypt.hash(passwordNuevo, 10);
        await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash } });
        // Invalida el resto de sesiones activas de este usuario — una
        // contrasena recien cambiada no deberia dejar sesiones viejas vivas.
        await prisma.sesion.deleteMany({ where: { usuarioId: usuario.id } });
        await auditLog(req.usuario.id, 'ACTUALIZAR', 'Usuario', usuario.id, { accion: 'cambio_password' }, req.ip, req.headers['user-agent']);
        logger.info({ usuarioId: usuario.id }, 'Contrasena cambiada');
        res.json({ message: 'Contrasena actualizada' });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        }
        logger.error({ err }, 'Error cambiando contrasena');
        res.status(500).json({ error: 'Error al cambiar contrasena' });
    }
});

const olvideSchema = z.object({ email: z.string().email('Email invalido') });
const restablecerSchema = z.object({
    token: z.string().min(20).max(200),
    passwordNuevo: z.string().min(8, 'La contrasena nueva debe tener al menos 8 caracteres'),
});

const olvideLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiadas solicitudes. Intente nuevamente en una hora.' },
});

const urlFrontend = () => {
    const desdeCors = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).find(o => o && !o.includes('localhost') && !o.includes('127.0.0.1'));
    return (process.env.FRONTEND_URL || desdeCors || 'http://localhost:5173').replace(/\/$/, '');
};

// Recuperacion de contrasena. Responde SIEMPRE lo mismo, exista o no el
// correo, para no revelar que cuentas existen.
router.post('/olvide-clave', olvideLimiter, async (req, res) => {
    const respuesta = { message: 'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña (vence en 30 minutos).' };
    try {
        const { email } = olvideSchema.parse(req.body);
        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (usuario && usuario.activo) {
            const token = crypto.randomBytes(32).toString('hex');
            // Solo el ultimo enlace vale: se invalidan los anteriores sin usar.
            await prisma.restablecerClave.deleteMany({ where: { usuarioId: usuario.id, usadoEn: null } });
            await prisma.restablecerClave.create({
                data: { usuarioId: usuario.id, tokenHash: hashToken(token), expiraEn: new Date(Date.now() + RESTABLECER_MINUTOS * 60 * 1000) },
            });
            const enlace = `${urlFrontend()}/?restablecer=${token}`;
            await sendEmail({
                to: usuario.email,
                subject: 'Recuperar contraseña - Sistema Contable',
                text: `Hola ${usuario.nombre},

Recibimos una solicitud para crear una nueva contraseña. Usa este enlace (vence en ${RESTABLECER_MINUTOS} minutos y solo sirve una vez):

${enlace}

Si no fuiste tú, ignora este correo: tu contraseña actual sigue siendo la misma.`,
            });
            await auditLog(usuario.id, 'SOLICITAR_RESTABLECER_CLAVE', 'Usuario', usuario.id, {}, req.ip, req.headers['user-agent']);
        }
        res.json(respuesta);
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Correo invalido' });
        logger.error({ err }, 'Error en olvide-clave');
        res.json(respuesta);
    }
});

router.post('/restablecer-clave', authLimiter, async (req, res) => {
    try {
        const { token, passwordNuevo } = restablecerSchema.parse(req.body);
        const registro = await prisma.restablecerClave.findUnique({ where: { tokenHash: hashToken(token) } });
        if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
            return res.status(400).json({ error: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
        }
        const passwordHash = await bcrypt.hash(passwordNuevo, 10);
        await prisma.$transaction([
            prisma.usuario.update({ where: { id: registro.usuarioId }, data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null } }),
            prisma.restablecerClave.update({ where: { id: registro.id }, data: { usadoEn: new Date() } }),
            prisma.sesion.deleteMany({ where: { usuarioId: registro.usuarioId } }),
        ]);
        await auditLog(registro.usuarioId, 'RESTABLECER_CLAVE', 'Usuario', registro.usuarioId, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Datos invalidos', detalles: err.errors.map(e => e.message) });
        logger.error({ err }, 'Error restableciendo contrasena');
        res.status(500).json({ error: 'No se pudo restablecer la contraseña' });
    }
});

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await prisma.sesion.deleteMany({ where: { token: req.headers.authorization?.split(' ')[1] } });
        res.json({ message: 'Sesion cerrada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesion' });
    }
});

module.exports = router;
