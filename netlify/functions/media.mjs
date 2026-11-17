// GET /media/<key>  -> a photo uploaded from the admin panel. Keys are unique, so the
// response can be cached for good.
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const key = context.params.key;
  if (!key || !/^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(key)) return new Response("Not found", { status: 404 });
  const result = await getStore("media").getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.data, {
    headers: {
      "content-type": (result.metadata && result.metadata.type) || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/media/:key" };
