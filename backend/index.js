// index.js — entrypoint: solo startup + listen. La app Express vive en app.js
// (los startup security checks de JWT_SECRET/ADMIN_API_TOKEN se ejecutan al
// inicio de app.js, antes de cargar las rutas)
const app = require('./app');
const { logger } = require('./logger');
const { prisma } = require('./shared');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`Backend corriendo en http://localhost:${PORT}`);
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Backup automatico programado (si esta habilitado por env)
try {
    const { scheduleBackups } = require('./backup');
    if (typeof scheduleBackups === 'function') scheduleBackups();
} catch (e) {
    logger.warn({ err: e.message }, 'Backup scheduler no disponible');
}

async function shutdown() {
    logger.info('Cerrando servidor...');
    await prisma.$disconnect();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
