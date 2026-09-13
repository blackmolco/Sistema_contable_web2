// Alertas por email con rate limiting
const { logger } = require('./shared');
const { sendEmail } = require('./email');

const sentAlerts = new Map(); // clave -> ultimo envio timestamp
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora entre alertas del mismo tipo

async function sendAlert(subject, body, key = subject) {
    const lastSent = sentAlerts.get(key);
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
        logger.debug({ key }, 'Alerta suprimida por rate limiting');
        return { sent: false, reason: 'rate_limited' };
    }

    const alertEmail = process.env.ALERT_EMAIL;
    if (!alertEmail) {
        logger.warn({ subject }, 'ALERT_EMAIL no configurado, alerta no enviada');
        return { sent: false, reason: 'smtp_not_configured' };
    }

    const resultado = await sendEmail({ to: alertEmail, subject: `[Sistema Contable] ${subject}`, text: body });
    if (resultado.sent) sentAlerts.set(key, Date.now());
    return resultado;
}

module.exports = { sendAlert };
