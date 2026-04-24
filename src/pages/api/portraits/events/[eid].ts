import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const eid = ctx.params.eid;
  if (typeof eid !== "string" || !eid) return json({ error: "missing_eid" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const ev = await db
    .prepare("SELECT id, name, location, happened_at, note, created_at FROM contact_card_events WHERE id = ?")
    .bind(eid)
    .first();
  if (!ev) return json({ error: "not_found" }, 404);

  const cardsRs = await db
    .prepare(`
      SELECT c.id, c.ocr_status, c.extracted, c.contact_id, c.captured_at, c.error
      FROM contact_card_event_links l
      JOIN contact_cards c ON c.id = l.card_id
      WHERE l.event_id = ?
      ORDER BY c.captured_at ASC
    `)
    .bind(eid)
    .all<{ id: string; ocr_status: string; extracted: string | null; contact_id: string | null; captured_at: string; error: string | null }>();
  const cards = ((cardsRs.results ?? []) as Array<{ id: string; ocr_status: string; extracted: string | null; contact_id: string | null; captured_at: string; error: string | null }>).map((c) => ({
    ...c,
    extracted: c.extracted ? JSON.parse(c.extracted) : null,
  }));

  return json({ event: ev, cards });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
