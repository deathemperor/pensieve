import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { extractContactFromCard } from "../../../../lib/portraits/ocr";

export const prerender = false;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];
const MAX_BYTES = 8 * 1024 * 1024;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contentType = ctx.request.headers.get("content-type") ?? "";
  if (!ALLOWED_MIME.includes(contentType as AllowedMime)) {
    return json({ error: "unsupported_media_type", allowed: ALLOWED_MIME }, 415);
  }
  const mime = contentType as AllowedMime;

  const buf = await ctx.request.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: "empty_body" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "too_large", max: MAX_BYTES }, 413);

  const id = ulid();
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const r2Key = `portraits/cards/${id}.${ext}`;
  const now = new Date().toISOString();

  const r2 = (env as any).MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;

  await r2.put(r2Key, buf, { httpMetadata: { contentType: mime } });
  await db
    .prepare(`INSERT INTO contact_cards (id, r2_key, captured_at, ocr_status, ocr_provider) VALUES (?,?,?,?,?)`)
    .bind(id, r2Key, now, "pending", "claude-vision")
    .run();

  const anthropicKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (anthropicKey) {
    const ctxAny = ctx as any;
    const waitUntil = ctxAny.locals?.runtime?.ctx?.waitUntil as undefined | ((p: Promise<unknown>) => void);
    const job = runOcr(id, mime, new Uint8Array(buf), anthropicKey, db);
    if (waitUntil) waitUntil(job);
    else await job;
  }

  return json({ card: { id, r2_key: r2Key, ocr_status: "pending" } }, 202);
};

async function runOcr(
  id: string,
  mime: AllowedMime,
  bytes: Uint8Array,
  apiKey: string,
  db: import("@cloudflare/workers-types").D1Database,
): Promise<void> {
  await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(id).run();
  const result = await extractContactFromCard(apiKey, bytes, mime);
  if (result.ok) {
    await db
      .prepare(`UPDATE contact_cards SET ocr_status='parsed', extracted=?, raw_ocr_json=?, error=NULL WHERE id=?`)
      .bind(JSON.stringify(result.value), JSON.stringify(result), id)
      .run();
  } else {
    await db
      .prepare(`UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?`)
      .bind(result.error, id)
      .run();
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  let randStr = "";
  let bits = 0, acc = 0;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | rand[i]; bits += 8;
    while (bits >= 5) { bits -= 5; randStr += CROCKFORD[(acc >> bits) & 31]; }
  }
  return time + randStr;
}
