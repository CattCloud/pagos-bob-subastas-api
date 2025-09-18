/**
 * Prueba directa de EmailJS desde backend.
 * Uso:
 *   Windows CMD:  set TEST_EMAIL=studiodreyk@gmail.com && node tests/email-test.js
 *   PowerShell:   $env:TEST_EMAIL="studiodreyk@gmail.com"; node tests/email-test.js
 *   Bash:         TEST_EMAIL="studiodreyk@gmail.com" node tests/email-test.js
 */
const emailService = require('../services/emailService');

(async () => {
  try {
    const to = process.env.TEST_EMAIL || 'studiodreyk@gmail.com';
    console.log('[EmailTest] Enviando correo de prueba a:', to);

    const res = await emailService.send({
      toEmail: to,
      subject: 'Prueba EmailJS - BOB Subastas',
      body: [
        'Este es un correo de prueba desde el backend (EmailJS).',
        'Si lo recibes, la integración está OK.',
        'Fecha: ' + new Date().toISOString(),
      ].join('\n'),
      // Puedes pasar templateParams extra si tu plantilla requiere otros campos:
      templateId: process.env.EMAILJS_TEMPLATE_ID,
      templateParams: {
        action_label: 'Ir al sistema',
        action_url: 'http://localhost:5173',
        timestamp: new Date().toLocaleString('es-PE'),
      },
    });

    console.log('[EmailTest] Respuesta EmailJS:', res);
    process.exit(0);
  } catch (e) {
    console.error('[EmailTest] Error EmailJS:');
    console.error('name:', e?.name);
    console.error('message:', e?.message);
    console.error('status:', e?.status);
    console.error('text:', e?.text);
    try { console.error('stack:', e?.stack); } catch (_) {}
    try { console.error('raw:', JSON.stringify(e)); } catch (_) {}
    process.exit(1);
  }
})();