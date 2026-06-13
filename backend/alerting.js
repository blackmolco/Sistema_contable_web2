// Alertas por email con rate limiting
const { logger } = require('./shared');

const sentAlerts = new Map(); // clave -> ultimo envio timestamp
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hora entre alertas del mismo tipo

async function sendAlert(subject, body, key = subject) {
    const lastSent = sentAlerts.get(key);
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
        logger.debug({ key }, 'Alerta suprimida por rate limiting');
        return { sent: false, reason: 'rate_limited' };
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const alertEmail = process.env.ALERT_EMAIL;

    if (!smtpHost || !alertEmail) {
        logger.warn({ subject }, 'SMTP no configurado, alerta no enviada');
        return { sent: false, reason: 'smtp_not_configured' };
    }

    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
        });

        await transporter.sendMail({
            from: smtpUser || 'sistema@contable.local',
            to: alertEmail,
            subject: `[Sistema Contable] ${subject}`,
            text: body,
        });

        sentAlerts.set(key, Date.now());
        logger.info({ subject, to: alertEmail }, 'Alerta enviada');
        return { sent: true };
    } catch (err) {
        logger.error({ err, subject }, 'Error enviando alerta');
        return { sent: false, reason: err.message };
    }
}

module.exports = { sendAlert };
