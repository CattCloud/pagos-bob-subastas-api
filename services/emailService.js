const emailjs = require('@emailjs/nodejs');
const { prisma } = require('../config/database');
const { Logger } = require('../middleware/logger');

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'BOB Subastas';
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'no-reply@bobsubastas.com';

function mask(val) {
  if (!val) return 'undefined';
  const s = String(val);
  if (s.length <= 8) return s[0] + '***' + s.slice(-1);
  return s.slice(0, 4) + '****' + s.slice(-4);
}

async function resolveRecipient({ toUserId, toEmail }) {
  if (toEmail) return { email: toEmail, name: null };
  if (!toUserId) throw new Error('toUserId or toEmail required');
  const user = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user?.email) throw new Error('Destinatario sin email');
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Usuario';
  return { email: user.email, name };
}

/**
 * Enviar correo transaccional usando EmailJS desde backend.
 * Requiere variables en .env:
 * - EMAILJS_SERVICE_ID
 * - EMAILJS_TEMPLATE_ID
 * - EMAILJS_PUBLIC_KEY
 * - EMAILJS_PRIVATE_KEY
 * Opcionales:
 * - EMAIL_SENDER_NAME
 * - EMAIL_SENDER
 */
async function send({ toUserId, toEmail, subject, body, templateId, templateParams } = {}) {
  const effectiveTemplateId = templateId || TEMPLATE_ID;
  if (!SERVICE_ID || !PUBLIC_KEY || !PRIVATE_KEY || !effectiveTemplateId) {
    Logger.error('[EmailService] Config incompleta', {
      SERVICE_ID: !!SERVICE_ID,
      TEMPLATE_ID: !!effectiveTemplateId,
      PUBLIC_KEY: !!PUBLIC_KEY,
      PRIVATE_KEY: !!PRIVATE_KEY,
    });
    throw new Error('EMAILJS no configurado (faltan variables EMAILJS_*)');
  }

  const recipient = await resolveRecipient({ toUserId, toEmail });

  const params = {
    from_name: SENDER_NAME,
    from_email: SENDER_EMAIL,
    to_email: recipient.email,
    to_name: recipient.name || 'Usuario',
    subject: subject || 'Notificación',
    message: body || '',
    ...templateParams,
  };

  // Log explícito en una sola línea porque nuestro Logger no serializa metadata
  Logger.info(`[EmailService] Enviando EmailJS -> to=${recipient.email} service=${SERVICE_ID} template=${effectiveTemplateId} publicKey=${mask(PUBLIC_KEY)} privateKey=${mask(PRIVATE_KEY)}`);

  try {
    const res = await emailjs.send(
      SERVICE_ID,
      effectiveTemplateId,
      params,
      { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY },
    );
    Logger.info(`EmailJS enviado a ${recipient.email}: ${res.status || ''} ${res.text || ''}`);
    return res;
  } catch (e) {
    const status = e?.status;
    const text = e?.text;
    Logger.warn(`[EmailService] Fallo EmailJS: status=${status || 'n/a'} text=${text || e?.message || 'n/a'}`);
    const err = new Error(text || e?.message || 'email_send_failed');
    err.status = status;
    err.text = text;
    throw err;
  }
}

module.exports = { send };