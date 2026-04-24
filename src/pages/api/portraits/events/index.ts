import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { ulid } from "../../../../lib/portraits/ulid";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT e.id, e.name, e.location, e.happened_at, e.note, e.created_at,
             COUNT(l.card_id) AS card_count
      FROM contact_card_events e
      LEFT JOIN contact_card_event_links l ON l.event_id = e.id
      GROUP BY e.id
      ORDER BY e.happened_at DESC
      LIMIT 50
    `)
    .all();
  return json({ events: rs.results ?? [] });
};

interface PostBody { name?: string; location?: string; happened_at?: string; note?: string }

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: PostBody;
  try { body = await ctx.request.json() as PostBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (typeof body.name !== "string" || !body.name.trim()) return json({ error: "name_required" }, 400);
  const happened_at = typeof body.happened_at === "string" && body.happened_at ? body.happened_at : new Date().toISOString();

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_card_events (id, name, location, happened_at, note, created_at) VALUES (?,?,?,?,?,?)`)
    .bind(id, body.name.trim(), body.location ?? null, happened_at, body.note ?? null, now)
    .run();
  return json({ event: { id, name: body.name.trim(), location: body.location ?? null, happened_at, note: body.note ?? null, created_at: now, card_count: 0 } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
