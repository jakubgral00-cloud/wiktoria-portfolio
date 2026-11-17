// POST /api/reset  { token, next }  ->  { token, expires }
// Sets a new password with the link from the "Nie pamiętam hasła" e-mail. One use, one hour.
import { authStore, configured, json, passwordProblem, pause, same, setPassword, sha256 } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configured()) return json({ error: "Panel nie jest skonfigurowany." }, 503);
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const store = authStore();
  const rec = await store.get("reset", { type: "json" });
  if (!rec || rec.exp < Date.now() || !body.token || !same(sha256(body.token), rec.hash)) {
    await pause(800);
    return json({ error: "Link wygasł albo był już użyty. Wyślij sobie nowy z ekranu logowania." }, 400);
  }
  const problem = passwordProblem(body.next);
  if (problem) return json({ error: problem }, 400);
  await store.delete("reset");
  return json(await setPassword(body.next));
};

export const config = { path: "/api/reset" };
