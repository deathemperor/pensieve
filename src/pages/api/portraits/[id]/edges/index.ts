import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { ulid } from "../../../../../lib/portraits/ulid";

export const prerender = false;

const KINDS = ["introduced_by", "works_with", "mentor_of", "invested_in", "spouse", "same_company"] as const;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT e.id, e.src_id, e.dst_id, e.kind, e.note, e.created_at,
             c.full_name AS dst_name, c.company AS dst_company, c.prestige_tier AS dst_tier
      FROM contact_edges e
      JOIN contacts c ON c.id = e.dst_id
      WHERE e.src_id = ? AND c.deleted_at IS NULL
      UNION ALL
      SELECT e.id, e.src_id, e.dst_id, e.kind, e.note, e.created_at,
             c.full_name AS dst_name, c.company AS dst_company, c.prestige_tier AS dst_tier
      FROM contact_edges e
      JOIN contacts c ON c.id = e.src_id
      WHERE e.dst_id = ? AND c.deleted_at IS NULL
    `)
    .bind(id, id)
    .all();
  return json({ edges: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const src_id = ctx.params.id;
  if (typeof src_id !== "string" || !src_id) return json({ error: "missing_id" }, 400);

  let body: { dst_id?: string; kind?: string; note?: string };
  try { body = await ctx.request.json() as any; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (typeof body.dst_id !== "string" || !body.dst_id.trim()) return json({ error: "dst_id_required" }, 400);
  if (body.dst_id === src_id) return json({ error: "cannot_link_to_self" }, 400);
  if (!KINDS.includes(body.kind as any)) return json({ error: "invalid_kind", allowed: KINDS }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  try {
    await db
      .prepare(`INSERT INTO contact_edges (id, src_id, dst_id, kind, note, created_at) VALUES (?,?,?,?,?,?)`)
      .bind(id, src_id, body.dst_id, body.kind, body.note ?? null, now)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("constraint")) return json({ error: "duplicate_edge" }, 409);
    return json({ error: `db_error: ${msg}` }, 500);
  }
  return json({ edge: { id, src_id, dst_id: body.dst_id, kind: body.kind, note: body.note ?? null, created_at: now } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
