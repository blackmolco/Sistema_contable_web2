const { Router } = require('express');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { parsePagination, paginatedResponse } = require('../middlewares/pagination');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');

const router = Router();
const writeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
    message: { error: 'Limite de operaciones alcanzado' },
});

const UPLOADS_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text', 'application/zip',
    'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'text/csv',
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const empresaId = req.body.empresaId || 'general';
        const categoria = (req.body.categoria || 'Otros').replace(/[^a-zA-Z0-9_-]/g, '_');
        const dir = path.join(UPLOADS_DIR, `empresa_${empresaId}`, categoria);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

function fileFilter(req, file, cb) {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.odt', '.pptx', '.ppt', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        return cb(new Error(`Extension no permitida: ${ext}`), false);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
    cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 50 * 1024 * 1024 } });

router.get('/categorias', async (req, res) => {
    try {
        const categorias = await prisma.categoriaDocumento.findMany({ orderBy: { nombre: 'asc' } });
        res.json(categorias);
    } catch {
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page, limit, offset } = parsePagination(req);
        const { categoria, trabajadorId, texto, activo = 'true' } = req.query;
        const empresaId = req.usuario.empresaId || null;
        const where = { activo: activo === 'true' };
        if (categoria) where.categoria = categoria;
        if (empresaId) where.empresaId = empresaId;
        if (trabajadorId) where.trabajadorId = trabajadorId;
        if (texto) {
            where.OR = [
                { nombre: { contains: texto } },
                { descripcion: { contains: texto } },
                { etiquetas: { contains: texto } },
            ];
        }
        const [total, documentos] = await Promise.all([
            prisma.documento.count({ where }),
            prisma.documento.findMany({ where, orderBy: { fechaSubida: 'desc' }, skip: offset, take: limit }),
        ]);
        res.json(paginatedResponse(documentos, total, page, limit));
    } catch (err) {
        logger.error({ err }, 'Error buscando documentos');
        res.status(500).json({ error: 'Error al buscar documentos' });
    }
});

router.post('/upload', authenticateToken, writeLimiter, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se encontro archivo' });
        }
        const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
        const nombreOriginal = sanitizeFilename(req.file.originalname);
        const documento = await prisma.documento.create({
            data: {
                nombre: nombreOriginal,
                tipo: path.extname(nombreOriginal).replace('.', '').toUpperCase(),
                categoria: req.body.categoria || 'Otros',
                empresaId: req.body.empresaId || null,
                trabajadorId: req.body.trabajadorId || null,
                usuarioId: req.usuario.id,
                ruta: req.file.path,
                tamano: req.file.size,
                mimeType: mime.lookup(req.file.path) || 'application/octet-stream',
                etiquetas: req.body.etiquetas || null,
                descripcion: req.body.descripcion || null,
                fechaDoc: req.body.fechaDoc ? new Date(req.body.fechaDoc) : null,
            },
        });
        await auditLog(req.usuario.id, 'SUBIR', 'Documento', documento.id, { nombre: nombreOriginal }, req.ip, req.headers['user-agent']);
        res.json(documento);
    } catch (err) {
        logger.error({ err }, 'Error subiendo documento');
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Error al subir documento' });
    }
});

router.get('/:id/descargar', authenticateToken, async (req, res) => {
    try {
        const documento = await prisma.documento.findUnique({ where: { id: req.params.id } });
        if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });
        const empresaId = req.usuario.empresaId || null;
        if (empresaId && documento.empresaId && documento.empresaId !== empresaId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        if (!fs.existsSync(documento.ruta)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        res.download(documento.ruta, documento.nombre);
    } catch (err) {
        logger.error({ err }, 'Error descargando documento');
        res.status(500).json({ error: 'Error al descargar documento' });
    }
});

router.delete('/:id', authenticateToken, writeLimiter, async (req, res) => {
    try {
        const documento = await prisma.documento.findUnique({ where: { id: req.params.id } });
        if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });
        const empresaId = req.usuario.empresaId || null;
        if (empresaId && documento.empresaId && documento.empresaId !== empresaId) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        await prisma.documento.update({ where: { id: req.params.id }, data: { activo: false } });
        await auditLog(req.usuario.id, 'ELIMINAR', 'Documento', req.params.id, {}, req.ip, req.headers['user-agent']);
        res.json({ message: 'Documento desactivado' });
    } catch (err) {
        logger.error({ err }, 'Error eliminando documento');
        res.status(500).json({ error: 'Error al eliminar documento' });
    }
});

module.exports = router;

