require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { logger, createRequestLogger } = require('./logger');
const { prisma } = require('./shared');
const { runBackup, getLastBackupInfo } = require('./backup');

// ============ STARTUP SECURITY CHECKS ============
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.startsWith('REEMPLAZA') || JWT_SECRET === 'dev-secret-change-in-production-2024') {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET no configurado o usa valor de desarrollo.');
        process.exit(1);
    } else {
        console.warn('ADVERTENCIA: JWT_SECRET usa valor de desarrollo. No usar en produccion.');
    }
}

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;
if (!ADMIN_API_TOKEN || ADMIN_API_TOKEN.startsWith('REEMPLAZA')) {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: ADMIN_API_TOKEN no configurado.');
        process.exit(1);
    }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render/Vercel proxy — needed for real IP in rate limiting

// ============ SECURITY HEADERS ============
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (process.env.HTTPS_ENABLED === 'true') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://api.mindicador.cl/api https://palmera.sii.cl https://zeus.sii.cl",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ];
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    next();
});

// ============ CORS ============
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
    maxAge: 86400,
}));

// ============ COMPRESSION (MEJORA 6) ============
try {
    const compression = require('compression');
    app.use(compression({
        level: 6,
        threshold: 1024,
    }));
} catch (e) {
    // compression no instalado aun
}

// ============ MIDDLEWARES ============
app.use(express.json({ limit: '1mb' }));
app.use(createRequestLogger());

// Global rate limiter removed — internal app with 3 users, per-route limiters on writes/auth are sufficient

// ============ UPLOADS DIR ============
const UPLOADS_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ============ INIT CATEGORIAS ============
const CATEGORIAS_POR_DEFECTO = [
    { nombre: 'Contratos', color: '#3b82f6', icono: 'FileText' },
    { nombre: 'Facturas', color: '#10b981', icono: 'Receipt' },
    { nombre: 'Boletas', color: '#8b5cf6', icono: 'FileCheck' },
    { nombre: 'Liquidaciones', color: '#f59e0b', icono: 'Calculator' },
    { nombre: 'Certificados', color: '#06b6d4', icono: 'Award' },
    { nombre: 'Legal', color: '#ef4444', icono: 'Scale' },
    { nombre: 'Informes', color: '#64748b', icono: 'BarChart3' },
    { nombre: 'Otros', color: '#6b7280', icono: 'Folder' },
];
async function inicializarCategorias() {
    for (const cat of CATEGORIAS_POR_DEFECTO) {
        await prisma.categoriaDocumento.upsert({ where: { nombre: cat.nombre }, update: {}, create: cat });
    }
}
inicializarCategorias().catch(() => {});

// ============ SWAGGER (MEJORA 5) ============
try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./swagger');
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} catch (e) {
    // swagger no instalado aun
}

// ============ ROUTES ============
const docsTribRouter = require('./routes/documentosTributarios');
const trabajadoresRouter = require('./routes/trabajadores');
const documentosRouter = require('./routes/documentos');

app.use('/api/auth',                   require('./routes/auth'));
app.use('/api/cuentas',                require('./routes/cuentas'));
app.use('/api/asientos',               require('./routes/asientos'));
app.use('/api/trabajadores',           trabajadoresRouter);
// Alias de compatibilidad: el frontend usa /api/liquidaciones directamente
app.use('/api/liquidaciones',          trabajadoresRouter);
app.use('/api/documentos-tributarios', docsTribRouter);
// Alias de compatibilidad: el frontend usa /api/libro-compras y /api/libro-ventas directamente
app.use('/api/libro-compras',          docsTribRouter);
app.use('/api/libro-ventas',           docsTribRouter);
app.use('/api/tesoreria',              require('./routes/tesoreria'));
app.use('/api/activos-fijos',          require('./routes/activosFijos'));
app.use('/api/honorarios',             require('./routes/honorarios'));
app.use('/api/documentos',             documentosRouter);
// /api/categorias se accede como /api/documentos/categorias
app.use('/api/normativa',              require('./routes/normativa'));
app.use('/api/sii',                    require('./routes/sii'));
app.use('/api/busqueda',               require('./routes/busqueda'));
app.use('/api/audit-logs',             require('./routes/auditoria'));
app.use('/api/empresas',               require('./routes/empresas'));
app.use('/api/tablas-sii',             require('./routes/tablasSii'));

// ============ HEALTH CHECK ENRIQUECIDO ============
app.get('/api/health', async (req, res) => {
    const checks = { db: false, uploads: false, lastBackup: null };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = true;
    } catch {}
    try {
        checks.uploads = fs.existsSync(UPLOADS_DIR);
    } catch {}
    try {
        checks.lastBackup = getLastBackupInfo();
    } catch {}

    const healthy = checks.db && checks.uploads;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks,
    });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'El archivo excede el limite' });
        }
        return res.status(400).json({ error: 'Error al procesar archivo' });
    }
    if (err) {
        logger.error({ err }, 'Error no manejado');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
    next();
});

module.exports = app;
