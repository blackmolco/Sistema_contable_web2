const pino = require('pino');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'logs/backend.log';
const isProduction = process.env.NODE_ENV === 'production';

const streams = [];

streams.push({
    level: logLevel,
    stream: pino.destination({
        dest: path.join(__dirname, logFile),
        mkdir: true,
        sync: false,
    }),
});

if (!isProduction) {
    try {
        const pinoPretty = require('pino-pretty');
        streams.push({
            level: logLevel,
            stream: pinoPretty({
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            }),
        });
    } catch {
        streams.push({
            level: logLevel,
            stream: process.stdout,
        });
    }
}

const logger = pino({
    level: logLevel,
    base: {
        app: 'sistema-contable-chile',
        version: '2.0.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
    },
}, pino.multistream(streams));

function createRequestLogger() {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info({
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            }, 'HTTP Request');
        });
        next();
    };
}

function createAuditLogger(prisma) {
    return async (usuarioId, accion, entidad, entidadId, detalles = {}, ipOrigen = '', userAgent = '') => {
        try {
            await prisma.auditLog.create({
                data: {
                    usuarioId: usuarioId || 'sistema',
                    accion,
                    entidad,
                    entidadId: String(entidadId),
                    detalles: JSON.stringify(detalles),
                    ipOrigen,
                    userAgent,
                },
            });
            logger.info({ usuarioId, accion, entidad, entidadId }, 'Audit Log');
        } catch (err) {
            logger.error({ err, usuarioId, accion, entidad }, 'Error writing audit log');
        }
    };
}

module.exports = {
    logger,
    createRequestLogger,
    createAuditLogger,
};
