import nodemailer from 'nodemailer';

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    // Dev fallback so password reset is testable without SMTP.
    console.log(`\n[mail:not-configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM || 'BAKACHIKI <no-reply@bakachiki.in>', to, subject, text });
}
