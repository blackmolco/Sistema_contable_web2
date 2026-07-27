const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getJwtSecret } = require('../shared');

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
    rol: z.enum(['admin', 'usuario', 'contador']).default('usuario'),
    empresaId: z.string().optional().nullable(),
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
// Solo admins pueden crear usuarios
router.post('/register', authenticateToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' });
        }
        const data = authRegisterSchema.parse(req.body);
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
                rut: data.rut ?? null,
                rol: data.rol,
                empresaId: data.empresaId ?? null,
                activo: true,
            },
        });
        await auditLog(req.usuario.id, 'CREAR', 'Usuario', usuario.id, { email: usuario.email, rol: usuario.rol }, req.ip, req.headers['user-agent']);
        logger.info({ createdBy: req.usuario.id, newUser: usuario.id }, 'Usuario creado');
        res.status(201).json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            empresaId: usuario.empresaId,
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
        const passwordValid = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValid) {
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
            data: { ultimoAcceso: new Date() },
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

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await prisma.sesion.deleteMany({ where: { token: req.headers.authorization?.split(' ')[1] } });
        res.json({ message: 'Sesion cerrada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesion' });
    }
});

module.exports = router;
