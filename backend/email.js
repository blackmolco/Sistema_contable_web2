// Envío de correos transaccionales (bienvenida, cambio de clave, cambio de
// rol/empresa) a usuarios del sistema. Comparte remitente con alerting.js
// (que envía avisos de error a un único correo de operación), pero este
// módulo envía a un destinatario arbitrario por llamada.
//
// Primario: API HTTP de Brevo (BREVO_API_KEY) -- Render bloquea las
// conexiones SMTP salientes en el plan free (confirmado: timeout tanto en
// puerto 587 como 465), asi que un envio por SMTP directo nunca llega desde
// ahi. La API de Brevo viaja por HTTPS igual que cualquier fetch normal.
// Si no hay BREVO_API_KEY, cae a SMTP por si esto corre en otro host que sí
// permita esas conexiones.
const { logger } = require('./shared');

const REMITENTE = process.env.SMTP_FROM || process.env.SMTP_USER || 'sistema@contable.local';

async function enviarPorBrevo({ to, subject, text, html }) {
    const apiKey = process.env.BREVO_API_KEY;
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender: { email: REMITENTE, name: 'Sistema Contable' },
            to: [{ email: to }],
            subject,
            textContent: text,
            ...(html ? { htmlContent: html } : {}),
        }),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        const cuerpo = await res.text().catch(() => '');
        throw new Error(`Brevo respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
    }
}

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

async function enviarPorSmtp({ to, subject, text, html }) {
    const transporter = getTransporter();
    if (!transporter) return { sent: false, reason: 'smtp_not_configured' };
    await transporter.sendMail({ from: REMITENTE, to, subject, text, html });
    return { sent: true };
}

async function sendEmail({ to, subject, text, html }) {
    try {
        if (process.env.BREVO_API_KEY) {
            await enviarPorBrevo({ to, subject, text, html });
            logger.info({ subject, to }, 'Correo enviado (Brevo)');
            return { sent: true };
        }
        const resultado = await enviarPorSmtp({ to, subject, text, html });
        if (!resultado.sent) {
            logger.warn({ subject, to }, 'SMTP no configurado, correo no enviado');
            return resultado;
        }
        logger.info({ subject, to }, 'Correo enviado (SMTP)');
        return resultado;
    } catch (err) {
        logger.error({ err, subject, to }, 'Error enviando correo');
        return { sent: false, reason: err.message };
    }
}

module.exports = { sendEmail, getTransporter };
