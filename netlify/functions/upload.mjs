// POST /api/upload  (admin only) body: the image bytes, Content-Type: image/jpeg|png|webp|gif
// -> { src: "media/<key>" }. The panel shrinks photos before sending, so they stay small.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { authorized, json } from "../lib/auth.mjs";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 5.5 * 1024 * 1024;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await authorized(req))) return json({ error: "Zaloguj się ponownie." }, 401);
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES[type]) return json({ error: "Dozwolone są zdjęcia JPG, PNG, WebP i GIF." }, 415);
  const bytes = await req.arrayBuffer();
  if (!bytes.byteLength) return json({ error: "Pusty plik." }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: "Zdjęcie jest za duże (max 5 MB)." }, 413);
  const key = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${TYPES[type]}`;
  await getStore("media").set(key, bytes, { metadata: { type } });
  return json({ src: `media/${key}` });
};

export const config = { path: "/api/upload" };
