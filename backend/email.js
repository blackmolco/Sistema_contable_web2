// Envío de correos transaccionales (bienvenida, cambio de clave, cambio de
// rol/empresa) a usuarios del sistema. Comparte la configuración SMTP con
// alerting.js (que envía avisos de error a un único correo de operación),
// pero este módulo envía a un destinatario arbitrario por llamada.
const { logger } = require('./shared');

function getTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) return null;
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        // Sin esto, un puerto bloqueado o un servidor SMTP que no responde deja
        // la conexion colgada indefinidamente -- y con ella, la request HTTP
        // que espera este envio (el usuario ve "Guardando..." para siempre).
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
    });
}

async function sendEmail({ to, subject, text, html }) {
    const transporter = getTransporter();
    if (!transporter) {
        logger.warn({ subject, to }, 'SMTP no configurado, correo no enviado');
        return { sent: false, reason: 'smtp_not_configured' };
    }
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'sistema@contable.local',
            to,
            subject,
            text,
            html,
        });
        logger.info({ subject, to }, 'Correo enviado');
        return { sent: true };
    } catch (err) {
        logger.error({ err, subject, to }, 'Error enviando correo');
        return { sent: false, reason: err.message };
    }
}

module.exports = { sendEmail, getTransporter };
