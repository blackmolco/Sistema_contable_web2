// Backup de SQLite con verificacion de integridad
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { logger } = require('./shared');

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || path.join(__dirname, 'prisma', 'dev.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

function getLastBackupInfo() {
    try {
        ensureBackupDir();
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);
        return files.length > 0 ? { file: files[0].name, date: files[0].mtime } : null;
    } catch {
        return null;
    }
}

async function runBackup() {
    ensureBackupDir();

    if (!fs.existsSync(DB_PATH)) {
        logger.warn({ DB_PATH }, 'Base de datos no encontrada para backup');
        return { success: false, error: 'BD no encontrada' };
    }

    // Verificar integridad antes del backup
    try {
        const sqlite3 = require('sqlite3');
        await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
                if (err) return reject(err);
            });
            db.get('PRAGMA integrity_check', (err, row) => {
                db.close();
                if (err) return reject(err);
                if (row?.integrity_check !== 'ok') return reject(new Error(`Integridad fallida: ${row?.integrity_check}`));
                resolve(row);
            });
        });
    } catch (err) {
        logger.error({ err }, 'Integridad de BD comprometida, abortando backup');
        return { success: false, error: err.message };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

    try {
        fs.copyFileSync(DB_PATH, backupPath);
        logger.info({ backupPath }, 'Backup completado');

        // Retener solo los ultimos 7 backups
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);

        files.slice(7).forEach(f => {
            try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch {}
        });

        return { success: true, file: backupPath };
    } catch (err) {
        logger.error({ err }, 'Error en backup');
        return { success: false, error: err.message };
    }
}

module.exports = { runBackup, getLastBackupInfo };
