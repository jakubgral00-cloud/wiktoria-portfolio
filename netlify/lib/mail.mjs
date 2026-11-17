// Sends the password-reset e-mail. Configure ONE of these in Netlify environment variables:
//
//   Gmail (or any SMTP):  SMTP_USER = the Gmail address
//                         SMTP_PASS = a Google "app password" (needs 2-Step Verification)
//                         SMTP_HOST / SMTP_PORT (optional; default smtp.gmail.com / 465)
//   Resend:               RESEND_API_KEY, MAIL_FROM (optional; without a verified domain
//                         Resend only delivers to the e-mail the Resend account was made with)
import nodemailer from "nodemailer";

const env = (name) => (process.env[name] || "").trim();

export const mailConfigured = () => Boolean(env("RESEND_API_KEY") || (env("SMTP_USER") && env("SMTP_PASS")));

export async function sendMail({ to, subject, text, html }) {
  if (env("RESEND_API_KEY")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env("MAIL_FROM") || "Panel strony <onboarding@resend.dev>", to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }
  const port = Number(env("SMTP_PORT") || 465);
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST") || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
  });
  await transport.sendMail({ from: env("MAIL_FROM") || `Panel strony <${env("SMTP_USER")}>`, to, subject, text, html });
}
