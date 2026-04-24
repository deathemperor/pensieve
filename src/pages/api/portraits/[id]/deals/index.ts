import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { ulid } from "../../../../../lib/portraits/ulid";

export const prerender = false;

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
type Stage = (typeof STAGES)[number];

interface PostBody {
  title?: string;
  stage?: string;
  value_cents?: number | null;
  currency?: string;
  probability?: number;
  expected_close_at?: string | null;
  summary?: string | null;
}

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT id, contact_id, title, stage, value_cents, currency, probability, expected_close_at,
             summary, created_at, updated_at, closed_at
      FROM contact_deals
      WHERE contact_id = ?
      ORDER BY
        CASE stage
          WHEN 'negotiation' THEN 0
          WHEN 'proposal'    THEN 1
          WHEN 'qualified'   THEN 2
          WHEN 'lead'        THEN 3
          WHEN 'closed_won'  THEN 4
          WHEN 'closed_lost' THEN 5
        END,
        created_at DESC
    `)
    .bind(id)
    .all();
  return json({ deals: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: PostBody;
  try { body = await ctx.request.json() as PostBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (typeof body.title !== "string" || !body.title.trim()) return json({ error: "title_required" }, 400);
  if (!STAGES.includes(body.stage as Stage)) return json({ error: "invalid_stage", allowed: STAGES }, 400);
  if (body.value_cents !== undefined && body.value_cents !== null && (typeof body.value_cents !== "number" || body.value_cents < 0)) {
    return json({ error: "invalid_value_cents" }, 400);
  }
  const probability = typeof body.probability === "number" ? body.probability : 50;
  if (probability < 0 || probability > 100) return json({ error: "invalid_probability" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  const stage = body.stage as Stage;
  const closed_at = (stage === "closed_won" || stage === "closed_lost") ? now : null;

  await db
    .prepare(`
      INSERT INTO contact_deals
        (id, contact_id, title, stage, value_cents, currency, probability,
         expected_close_at, summary, created_at, updated_at, closed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    .bind(
      id, contact_id, body.title.trim(), stage,
      body.value_cents ?? null,
      (body.currency ?? "USD").slice(0, 8),
      probability,
      body.expected_close_at ?? null,
      body.summary ?? null,
      now, now, closed_at,
    )
    .run();

  return json({
    deal: {
      id, contact_id, title: body.title.trim(), stage,
      value_cents: body.value_cents ?? null,
      currency: body.currency ?? "USD",
      probability,
      expected_close_at: body.expected_close_at ?? null,
      summary: body.summary ?? null,
      created_at: now, updated_at: now, closed_at,
    },
  }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
