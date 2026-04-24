import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "7", 10), 1), 90);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86400 * 1000).toISOString().slice(0, 10);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT r.id, r.contact_id, r.kind, r.due_at, r.body, c.full_name, c.prestige_tier
      FROM contact_reminders r
      JOIN contacts c ON c.id = r.contact_id
      WHERE r.dismissed_at IS NULL
        AND date(r.due_at) <= date(?)
        AND c.deleted_at IS NULL
      ORDER BY r.due_at ASC
      LIMIT 50
    `)
    .bind(horizon)
    .all();
  return json({ reminders: rs.results ?? [] });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
