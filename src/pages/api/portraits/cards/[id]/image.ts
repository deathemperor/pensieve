import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return new Response("forbidden", { status: 403 });

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return new Response("bad request", { status: 400 });

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const row = await db.prepare("SELECT r2_key FROM contact_cards WHERE id=?").bind(id).first<{ r2_key: string }>();
  if (!row) return new Response("not found", { status: 404 });

  const r2 = (env as any).MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const obj = await r2.get(row.r2_key);
  if (!obj) return new Response("not found", { status: 404 });

  const mime = obj.httpMetadata?.contentType ??
    (row.r2_key.endsWith(".png") ? "image/png" :
     row.r2_key.endsWith(".webp") ? "image/webp" : "image/jpeg");

  return new Response(obj.body, {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
  });
};
