const nodemailer = require('nodemailer');

// In-memory rate limiting map: ip -> [timestamps]
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  
  // Cleanup old entries
  if (rateLimitMap.size > 1000) {
    for (const [key, list] of rateLimitMap.entries()) {
      if (list.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }
  return false;
}

function sanitizeHeader(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée. Seul POST est accepté.' });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Trop de requêtes. Veuillez patienter quelques minutes avant de renvoyer un message.'
      });
    }

    const { name, email, subject, message, _gotcha } = req.body || {};

    // Honeypot check (anti-spam)
    if (_gotcha) {
      // Pretend success to fool bots
      return res.status(200).json({ success: true, message: 'Message reçu.' });
    }

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Veuillez indiquer un nom valide (au moins 2 caractères).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Veuillez indiquer une adresse email valide.' });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Veuillez rédiger un message d\'au moins 10 caractères.' });
    }

    const cleanName = sanitizeHeader(name);
    const cleanEmail = sanitizeHeader(email);
    const cleanSubject = sanitizeHeader(subject || 'Demande de contact générale');
    const cleanMessage = message.trim();

    // SMTP Credentials (can be overridden by Vercel environment variables)
    const SMTP_HOST = process.env.SMTP_HOST || 'mail.connect-gm.com';
    const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
    const SMTP_USER = process.env.SMTP_USER || 'dataset@connect-gm.com';
    const SMTP_PASS = process.env.SMTP_PASS;
    if (!SMTP_PASS) return res.status(503).json({ success: false, error: 'Messagerie temporairement indisponible.' });
    const RECIPIENT = process.env.CONTACT_DEST || 'dataset@connect-gm.com, contact@connect-gm.com';

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: {
        rejectUnauthorized: true
      }
    });

    const emailSubject = `[ALN Dataset] ${cleanSubject} - ${cleanName}`;
    const sentDate = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #16a34a; }
    .header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 0.85rem; color: #94a3b8; }
    .content { padding: 24px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .meta-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .meta-table td.label { font-weight: 600; color: #64748b; width: 130px; background-color: #f8fafc; }
    .meta-table td.value { color: #0f172a; font-weight: 500; }
    .message-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #16a34a; border-radius: 4px; padding: 16px; margin-top: 12px; font-size: 0.95rem; white-space: pre-wrap; word-break: break-word; color: #1e293b; }
    .footer { padding: 14px 24px; background: #f1f5f9; font-size: 0.8rem; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🇩🇿 Nouveau message via le portail ALN Dataset</h2>
      <p>Portail cartographique & recherche historique (1954–1962)</p>
    </div>
    <div class="content">
      <table class="meta-table">
        <tr>
          <td class="label">Expéditeur :</td>
          <td class="value">${escapeHtml(cleanName)}</td>
        </tr>
        <tr>
          <td class="label">Adresse Email :</td>
          <td class="value"><a href="mailto:${escapeHtml(cleanEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(cleanEmail)}</a></td>
        </tr>
        <tr>
          <td class="label">Objet / Motif :</td>
          <td class="value"><strong>${escapeHtml(cleanSubject)}</strong></td>
        </tr>
        <tr>
          <td class="label">Date d'envoi :</td>
          <td class="value">${sentDate} (Heure d'Alger)</td>
        </tr>
      </table>
      <div style="font-weight: 600; color: #334155; margin-top: 16px;">Contenu du message :</div>
      <div class="message-box">${escapeHtml(cleanMessage)}</div>
    </div>
    <div class="footer">
      Cet email a été envoyé automatiquement depuis le formulaire de contact du portail ALN Dataset.<br>
      Vous pouvez répondre directement à cet email pour contacter l'expéditeur.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Nouveau message via le portail ALN Dataset (1954-1962)
------------------------------------------------------
Expéditeur: ${cleanName}
Email: ${cleanEmail}
Objet: ${cleanSubject}
Date: ${sentDate}

Message:
${cleanMessage}
    `.trim();

    await transporter.sendMail({
      from: `"ALN Dataset Portal" <${SMTP_USER}>`,
      to: RECIPIENT,
      replyTo: `${cleanName} <${cleanEmail}>`,
      subject: emailSubject,
      text: textContent,
      html: htmlContent
    });

    return res.status(200).json({
      success: true,
      message: 'Votre message a été transmis avec succès. Merci pour votre prise de contact !'
    });

  } catch (err) {
    console.error('Contact handler error:', err.code || 'DELIVERY_FAILED');
    return res.status(500).json({
      success: false,
      error: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer ultérieurement.'
    });
  }
};
