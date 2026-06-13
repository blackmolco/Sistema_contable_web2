// Exporta las instancias compartidas para evitar circular dependencies
const { PrismaClient } = require('@prisma/client');
const { logger, createAuditLogger } = require('./logger');

const prisma = new PrismaClient();
const auditLog = createAuditLogger(prisma);

// JWT_SECRET se toma del proceso (ya validado en index.js antes de que se carguen las rutas)
function getJwtSecret() {
    return process.env.JWT_SECRET;
}

module.exports = { prisma, logger, auditLog, getJwtSecret };
