import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Public read-through for animation artifacts on R2. Only serves paths
// under `animations/` so you can't read other bucket contents. Immutable
// cache since keys are content-hash suffixed.
export const GET: APIRoute = async ({ params }) => {
  const rawKey = (params as { key?: string }).key;
  if (!rawKey || !rawKey.startsWith("animations/")) {
    return new Response("not found", { status: 404 });
  }

  const media = (env as unknown as { MEDIA?: { get: (k: string) => Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null> } }).MEDIA;
  if (!media) return new Response("media binding missing", { status: 500 });

  const obj = await media.get(rawKey);
  if (!obj) return new Response("not found", { status: 404 });

  const ct = obj.httpMetadata?.contentType
    ?? (rawKey.endsWith(".png") ? "image/png"
        : rawKey.endsWith(".gz") ? "application/gzip"
        : rawKey.endsWith(".json") ? "application/json"
        : "application/octet-stream");

  return new Response(obj.body, {
    headers: {
      "content-type": ct,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
