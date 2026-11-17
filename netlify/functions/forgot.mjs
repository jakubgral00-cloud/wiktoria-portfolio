// POST /api/forgot  { email }  ->  { ok, message }
// "Nie pamiętam hasła": if the e-mail is the admin's, sends a one-hour link to /admin/#reset=<token>.
// The reply is the same whether or not the e-mail matched, so it can't be used to guess the address.
import { randomBytes } from "node:crypto";
import { authStore, configured, isAdminEmail, json, pause, sha256 } from "../lib/auth.mjs";
import { mailConfigured, sendMail } from "../lib/mail.mjs";

const LINK_MINUTES = 60;
const RESEND_AFTER_MS = 60 * 1000;
const DONE = "Jeśli ten adres jest przypisany do panelu, wysłaliśmy na niego link do ustawienia nowego hasła. Sprawdź też folder Spam.";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configured()) return json({ error: "Panel nie jest skonfigurowany." }, 503);
  if (!mailConfigured()) {
    return json({ error: "Wysyłanie maili nie jest jeszcze skonfigurowane. Poproś Jakuba o ustawienie hasła w Netlify." }, 503);
  }
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const started = Date.now();

  if (isAdminEmail(body.email)) {
    const store = authStore();
    const previous = await store.get("reset", { type: "json" });
    if (!previous || Date.now() - previous.sent_at > RESEND_AFTER_MS) {
      const token = randomBytes(32).toString("base64url");
      await store.setJSON("reset", { hash: sha256(token), exp: Date.now() + LINK_MINUTES * 60 * 1000, sent_at: Date.now() });
      const base = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
      const link = `${base}/admin/#reset=${token}`;
      const host = new URL(base).host;
      try {
        await sendMail({
          to: process.env.ADMIN_EMAIL.trim(),
          subject: "Nowe hasło do panelu strony",
          text: `Cześć,\n\nktoś (pewnie Ty) poprosił o nowe hasło do panelu strony ${host}.\n\nKliknij link, żeby ustawić nowe hasło (ważny przez ${LINK_MINUTES} minut):\n${link}\n\nJeśli to nie Ty, zignoruj tę wiadomość — hasło się nie zmieni.\n`,
          html: `<p>Cześć,</p><p>ktoś (pewnie Ty) poprosił o nowe hasło do panelu strony ${host}.</p>` +
            `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#161412;color:#fff;text-decoration:none">Ustaw nowe hasło</a></p>` +
            `<p>Link jest ważny przez ${LINK_MINUTES} minut. Jeśli to nie Ty, zignoruj tę wiadomość — hasło się nie zmieni.</p>`,
        });
      } catch (error) {
        console.error("reset mail failed:", error.message);
        await store.delete("reset");
        return json({ error: "Nie udało się wysłać maila. Spróbuj za chwilę." }, 502);
      }
    }
  }

  // Same timing either way.
  await pause(Math.max(0, 900 - (Date.now() - started)));
  return json({ ok: true, message: DONE });
};

export const config = { path: "/api/forgot" };
