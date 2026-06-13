// Cola de jobs async simple en memoria (sin Redis)
const { logger } = require('./shared');

const queue = [];
let running = false;

async function processNext() {
    if (running || queue.length === 0) return;
    running = true;
    const job = queue.shift();
    try {
        logger.info({ jobType: job.type }, 'Procesando job');
        await job.handler();
        logger.info({ jobType: job.type }, 'Job completado');
    } catch (err) {
        logger.error({ err, jobType: job.type }, 'Error en job');
    } finally {
        running = false;
        setImmediate(processNext);
    }
}

function enqueue(type, handler) {
    queue.push({ type, handler, enqueuedAt: new Date() });
    setImmediate(processNext);
}

function size() {
    return queue.length;
}

// ============ JOBS CON ESTADO (para SSE / polling) ============
const { randomUUID } = require('crypto');
const jobs = new Map(); // jobId -> { status, result, error, createdAt }
const JOB_TTL_MS = 30 * 60 * 1000; // limpiar jobs viejos a los 30 min

function cleanupJobs() {
    const now = Date.now();
    for (const [id, job] of jobs) {
        if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
    }
}

/**
 * Encola un trabajo asincrono y retorna un jobId para consultar su estado.
 * El valor retornado por handler se guarda en job.result.
 */
function submit(type, handler) {
    cleanupJobs();
    const jobId = randomUUID();
    jobs.set(jobId, { status: 'pending', result: null, error: null, code: null, createdAt: Date.now() });
    enqueue(type, async () => {
        const job = jobs.get(jobId);
        if (!job) return;
        job.status = 'running';
        try {
            job.result = await handler();
            job.status = 'done';
        } catch (err) {
            job.error = err.mensaje || err.message || 'Error en job';
            job.code = err.code || null;
            job.status = 'failed';
        }
    });
    return jobId;
}

function getStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) return { status: 'not_found', result: null, error: null };
    return { status: job.status, result: job.result, error: job.error, code: job.code };
}

module.exports = { enqueue, size, submit, getStatus };
