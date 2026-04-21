import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { extractContactFromCard } from "../../../../../lib/portraits/ocr";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const row = await db.prepare("SELECT r2_key FROM contact_cards WHERE id=?").bind(id).first<{ r2_key: string }>();
  if (!row) return json({ error: "not_found" }, 404);

  const apiKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return json({ error: "ocr_unavailable", hint: "set ANTHROPIC_API_KEY via wrangler secret" }, 503);

  const r2 = (env as any).MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const obj = await r2.get(row.r2_key);
  if (!obj) return json({ error: "r2_gone" }, 410);

  const mime = obj.httpMetadata?.contentType ?? "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    return json({ error: `unsupported_mime: ${mime}` }, 415);
  }

  await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(id).run();
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const result = await extractContactFromCard(apiKey, bytes, mime as "image/jpeg" | "image/png" | "image/webp");

  if (result.ok) {
    await db
      .prepare("UPDATE contact_cards SET ocr_status='parsed', extracted=?, error=NULL WHERE id=?")
      .bind(JSON.stringify(result.value), id)
      .run();
    return json({ card: { id, ocr_status: "parsed", extracted: result.value } });
  }

  await db.prepare("UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?").bind(result.error, id).run();
  return json({ card: { id, ocr_status: "failed", error: result.error } }, 502);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
