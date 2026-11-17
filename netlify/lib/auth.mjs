// Shared helpers for the admin API: password check, signed session token, JSON replies.
//
// Netlify environment variables:
//   ADMIN_EMAIL, ADMIN_PASSWORD  (required) the login e-mail and the starting password
//   SESSION_SECRET               (optional) key for signing sessions
//
// Once Wiktoria changes her password in the panel (or through the e-mailed reset link),
// a scrypt hash of it is kept in Netlify Blobs (store "admin-auth") and replaces
// ADMIN_PASSWORD. Setting a NEW value of ADMIN_PASSWORD in Netlify (and redeploying)
// overrides the stored one again — that's the manual way back in.
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getStore } from "@netlify/blobs";

const scrypt = promisify(scryptCb);
const SESSION_DAYS = 30;
export const MIN_PASSWORD = 8;

const env = (name) => (process.env[name] || "").trim();
export const authStore = () => getStore({ name: "admin-auth", consistency: "strong" });

export function configured() {
  return Boolean(env("ADMIN_EMAIL") && env("ADMIN_PASSWORD"));
}

export const sha256 = (text) => createHash("sha256").update(String(text)).digest("base64url");

export function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export const isAdminEmail = (email) =>
  configured() && same(String(email || "").trim().toLowerCase(), env("ADMIN_EMAIL").toLowerCase());

// Ties a stored password to the ADMIN_PASSWORD it replaced, so changing the env var wins.
const envFingerprint = () => sha256(`wwg-env:${env("ADMIN_PASSWORD")}`).slice(0, 22);

// The password saved from the panel, or null when ADMIN_PASSWORD applies.
async function storedPassword() {
  const rec = await authStore().get("password", { type: "json" });
  return rec && rec.env === envFingerprint() ? rec : null;
}

export async function checkPassword(password) {
  if (!configured()) return false;
  const rec = await storedPassword();
  if (!rec) return same(String(password || ""), env("ADMIN_PASSWORD"));
  const hash = await scrypt(String(password || ""), Buffer.from(rec.salt, "base64url"), 64);
  return same(hash.toString("base64url"), rec.hash);
}

export async function checkCredentials(email, password) {
  const okPassword = await checkPassword(password);
  return isAdminEmail(email) && okPassword;
}

export function passwordProblem(password) {
  const p = String(password || "");
  if (p.length < MIN_PASSWORD) return `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`;
  if (p.length > 200) return "Hasło jest za długie.";
  return null;
}

// Saves a new password and returns a fresh session; sessions on other devices end.
export async function setPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(password), salt, 64);
  const rec = {
    salt: salt.toString("base64url"),
    hash: hash.toString("base64url"),
    env: envFingerprint(),
    changed_at: Date.now(),
  };
  await authStore().setJSON("password", rec);
  return issueToken(rec);
}

function secret() {
  return env("SESSION_SECRET") || `wwg-admin:${env("ADMIN_EMAIL")}:${env("ADMIN_PASSWORD")}`;
}

function sign(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Sessions carry the password version, so a password change logs out other devices.
const versionOf = (rec) => (rec ? rec.changed_at.toString(36) : "0");

export async function issueToken(rec) {
  const version = versionOf(rec === undefined ? await storedPassword() : rec);
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${exp}.${version}`;
  return { token: `${payload}.${sign(payload)}`, expires: exp };
}

export async function authorized(req) {
  if (!configured()) return false;
  const header = req.headers.get("authorization") || "";
  const [exp, version, sig] = header.replace(/^Bearer\s+/i, "").split(".");
  if (!exp || !version || !sig || !same(sig, sign(`${exp}.${version}`))) return false;
  if (Number(exp) <= Date.now()) return false;
  return version === versionOf(await storedPassword());
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
