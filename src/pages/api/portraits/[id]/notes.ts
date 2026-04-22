import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { ulid } from "../../../../lib/portraits/ulid";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT id, body, created_at, updated_at FROM contact_notes WHERE contact_id=? ORDER BY created_at DESC")
    .bind(id)
    .all();
  return json({ notes: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: { body?: string };
  try { body = await ctx.request.json() as { body?: string }; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (typeof body.body !== "string" || !body.body.trim()) return json({ error: "body_required" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_notes (id, contact_id, body, created_at, updated_at) VALUES (?,?,?,?,?)`)
    .bind(id, contact_id, body.body.trim(), now, now)
    .run();
  return json({ note: { id, contact_id, body: body.body.trim(), created_at: now, updated_at: now } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
