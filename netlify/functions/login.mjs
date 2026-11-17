// POST /api/login  { email, password }  ->  { token, expires }
import { checkCredentials, configured, issueToken, json } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configured()) {
    return json({ error: "Panel nie jest skonfigurowany: ustaw ADMIN_EMAIL i ADMIN_PASSWORD w Netlify." }, 503);
  }
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (!(await checkCredentials(body.email, body.password))) {
    // A short pause makes guessing passwords slower.
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "Nieprawidłowy e-mail lub hasło." }, 401);
  }
  return json(await issueToken());
};

export const config = { path: "/api/login" };
