// Shared helpers for the admin API: a signed session token and JSON replies.
// Credentials live only in Netlify environment variables:
//   ADMIN_EMAIL, ADMIN_PASSWORD  (required)
//   SESSION_SECRET               (optional; defaults to a value derived from the two above,
//                                 so changing the password logs every device out)
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_DAYS = 30;

const env = (name) => (process.env[name] || "").trim();

export function configured() {
  return Boolean(env("ADMIN_EMAIL") && env("ADMIN_PASSWORD"));
}

function secret() {
  return env("SESSION_SECRET") || `wwg-admin:${env("ADMIN_EMAIL")}:${env("ADMIN_PASSWORD")}`;
}

function sign(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCredentials(email, password) {
  if (!configured()) return false;
  const okEmail = same(String(email || "").trim().toLowerCase(), env("ADMIN_EMAIL").toLowerCase());
  const okPassword = same(String(password || ""), env("ADMIN_PASSWORD"));
  return okEmail && okPassword;
}

export function issueToken() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(exp);
  return { token: `${payload}.${sign(payload)}`, expires: exp };
}

export function authorized(req) {
  if (!configured()) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !same(sig, sign(payload))) return false;
  return Number(payload) > Date.now();
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
