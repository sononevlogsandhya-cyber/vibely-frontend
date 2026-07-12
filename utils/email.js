const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // No SMTP configured — fall back to console logging so local dev still works.
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Sends an email. If SMTP isn't configured (no .env values), it logs the
 * email to the console instead of throwing — handy for local dev/testing.
 */
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();

  if (!t) {
    console.log("\n📧 [DEV MODE — SMTP not configured] Email not actually sent:");
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text || html}\n`);
    return { devMode: true };
  }

  return t.sendMail({
    from: process.env.EMAIL_FROM || `"Vibely" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

function otpEmailTemplate({ code, purposeLabel }) {
  return `
    <div style="font-family:sans-serif;max-width:420px;margin:auto;background:#1c1626;color:#f2eef7;padding:24px;border-radius:16px;">
      <h2 style="color:#ff5c77;margin-top:0;">Vibely</h2>
      <p>Your ${purposeLabel} code is:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#ffb347;">${code}</p>
      <p style="color:#a89bb8;font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

module.exports = { sendEmail, otpEmailTemplate };
