import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { ulid } from "../../../../../lib/portraits/ulid";
import { extractContactFromCard } from "../../../../../lib/portraits/ocr";

export const prerender = false;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BATCH = 20;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const eid = ctx.params.eid;
  if (typeof eid !== "string" || !eid) return json({ error: "missing_eid" }, 400);

  const e = env as any;
  const db = e.DB as import("@cloudflare/workers-types").D1Database;
  const r2 = e.MEDIA as import("@cloudflare/workers-types").R2Bucket;

  const ev = await db.prepare("SELECT id FROM contact_card_events WHERE id = ?").bind(eid).first();
  if (!ev) return json({ error: "event_not_found" }, 404);

  // Parse multipart/form-data. Use native FormData.
  const contentType = ctx.request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return json({ error: "expected_multipart_form_data" }, 415);
  }

  const form = await ctx.request.formData();
  const files: File[] = [];
  for (const [k, v] of form.entries()) {
    if (k !== "card") continue;
    if (v instanceof File) files.push(v);
  }
  if (files.length === 0) return json({ error: "no_files" }, 400);
  if (files.length > MAX_BATCH) return json({ error: "too_many", max: MAX_BATCH }, 413);

  const now = new Date().toISOString();
  const apiKey = e.ANTHROPIC_API_KEY as string | undefined;
  const waitUntil = (ctx as any).locals?.runtime?.ctx?.waitUntil as undefined | ((p: Promise<unknown>) => void);

  const accepted: Array<{ id: string; r2_key: string; ocr_status: string }> = [];

  for (const file of files) {
    const mime = (file.type && ALLOWED_MIME.includes(file.type as AllowedMime)) ? (file.type as AllowedMime) : "image/jpeg";
    const buf = await file.arrayBuffer();
    if (buf.byteLength === 0) continue;
    if (buf.byteLength > MAX_BYTES) continue;

    const cardId = ulid();
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const r2Key = `portraits/cards/${cardId}.${ext}`;

    await r2.put(r2Key, buf, { httpMetadata: { contentType: mime } });
    await db
      .prepare(`INSERT INTO contact_cards (id, r2_key, captured_at, ocr_status, ocr_provider) VALUES (?,?,?,?,?)`)
      .bind(cardId, r2Key, now, "pending", "claude-vision")
      .run();
    await db
      .prepare(`INSERT INTO contact_card_event_links (card_id, event_id, created_at) VALUES (?,?,?)`)
      .bind(cardId, eid, now)
      .run();

    accepted.push({ id: cardId, r2_key: r2Key, ocr_status: "pending" });

    // Kick OCR per card. Chunked-base64-safe by calling into the existing Phase 2 helper.
    if (apiKey) {
      const job = (async () => {
        await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(cardId).run();
        const result = await extractContactFromCard(apiKey, new Uint8Array(buf), mime);
        if (result.ok) {
          await db.prepare(`UPDATE contact_cards SET ocr_status='parsed', extracted=?, error=NULL WHERE id=?`)
            .bind(JSON.stringify(result.value), cardId).run();
        } else {
          const errMsg = (result as { ok: false; error: string }).error;
          await db.prepare(`UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?`)
            .bind(errMsg, cardId).run();
        }
      })();
      if (waitUntil) waitUntil(job);
      else await job;
    }
  }

  return json({ event_id: eid, accepted }, 202);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
