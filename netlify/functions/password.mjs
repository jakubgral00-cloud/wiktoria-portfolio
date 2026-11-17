// POST /api/password  (admin only)  { current, next }  ->  { token, expires }
// Changes the password from inside the panel. This device stays logged in; others are logged out.
import { authorized, checkPassword, json, passwordProblem, pause, setPassword } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await authorized(req))) return json({ error: "Zaloguj się ponownie." }, 401);
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (!(await checkPassword(body.current))) {
    await pause(800);
    return json({ error: "Obecne hasło jest nieprawidłowe." }, 400);
  }
  const problem = passwordProblem(body.next);
  if (problem) return json({ error: problem }, 400);
  return json(await setPassword(body.next));
};

export const config = { path: "/api/password" };
