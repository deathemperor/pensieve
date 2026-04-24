import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;

  // Expected value = Σ (value_cents × probability / 100) across open deals, grouped by currency.
  const rs = await db
    .prepare(`
      SELECT
        currency,
        SUM(COALESCE(value_cents, 0) * probability / 100) AS expected_cents,
        SUM(COALESCE(value_cents, 0))                     AS raw_cents,
        COUNT(*)                                           AS count
      FROM contact_deals
      WHERE closed_at IS NULL
      GROUP BY currency
    `)
    .all<{ currency: string; expected_cents: number; raw_cents: number; count: number }>();

  const byCurrency = (rs.results ?? []) as Array<{ currency: string; expected_cents: number; raw_cents: number; count: number }>;
  return json({ open: byCurrency });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
