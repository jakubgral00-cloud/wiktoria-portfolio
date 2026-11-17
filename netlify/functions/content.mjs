// GET /api/content  -> the content saved from the admin panel (404 until the first save;
//                      the site then falls back to the bundled content.json)
// PUT /api/content  -> save the whole content object (admin only). Every save also
//                      keeps a dated copy under history/ so an older version can be restored.
// GET /api/content?history=1 -> list of saved versions (admin only)
// GET /api/content?version=<key> -> one saved version (admin only)
import { getStore } from "@netlify/blobs";
import { authorized, json } from "../lib/auth.mjs";

const MAX_BYTES = 8 * 1024 * 1024;
const store = () => getStore({ name: "site-content", consistency: "strong" });

function valid(data) {
  return data && typeof data === "object" && data.profile && typeof data.profile === "object" &&
    typeof data.profile.display_name === "string" && Array.isArray(data.projects);
}

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.has("history") || url.searchParams.has("version")) {
      if (!(await authorized(req))) return json({ error: "Zaloguj się ponownie." }, 401);
      if (url.searchParams.has("history")) {
        const { blobs } = await store().list({ prefix: "history/" });
        return json({ versions: blobs.map((b) => b.key).sort().reverse().slice(0, 50) });
      }
      const key = url.searchParams.get("version");
      if (!key.startsWith("history/")) return json({ error: "Bad version" }, 400);
      const data = await store().get(key, { type: "json" });
      return data ? json(data) : json({ error: "Not found" }, 404);
    }
    const data = await store().get("content", { type: "json" });
    if (!data) return json({ error: "No saved content yet" }, 404);
    return json(data);
  }

  if (req.method === "PUT") {
    if (!(await authorized(req))) return json({ error: "Zaloguj się ponownie." }, 401);
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "Za duże dane." }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return json({ error: "Nieprawidłowe dane." }, 400); }
    if (!valid(data)) return json({ error: "Brakuje profilu albo listy projektów." }, 400);
    data.saved_at = new Date().toISOString();
    const body = JSON.stringify(data);
    await store().set("content", body);
    await store().set(`history/${data.saved_at.replace(/[:.]/g, "-")}`, body);
    return json({ ok: true, saved_at: data.saved_at });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/content" };
