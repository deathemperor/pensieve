import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
type Stage = (typeof STAGES)[number];

interface PatchBody {
  title?: string;
  stage?: string;
  value_cents?: number | null;
  currency?: string;
  probability?: number;
  expected_close_at?: string | null;
  summary?: string | null;
}

export const PATCH: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const did = ctx.params.did;
  if (typeof did !== "string" || !did) return json({ error: "missing_did" }, 400);

  let body: PatchBody;
  try { body = await ctx.request.json() as PatchBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (body.stage !== undefined && !STAGES.includes(body.stage as Stage)) return json({ error: "invalid_stage" }, 400);
  if (body.probability !== undefined && (typeof body.probability !== "number" || body.probability < 0 || body.probability > 100)) {
    return json({ error: "invalid_probability" }, 400);
  }

  const fields: string[] = [];
  const binds: unknown[] = [];
  const passthrough = ["title", "stage", "value_cents", "currency", "probability", "expected_close_at", "summary"] as const;
  for (const k of passthrough) {
    if ((body as Record<string, unknown>)[k] !== undefined) {
      fields.push(`${k} = ?`);
      binds.push((body as Record<string, unknown>)[k] as unknown);
    }
  }
  if (fields.length === 0) return json({ error: "no_fields" }, 400);

  const now = new Date().toISOString();
  fields.push("updated_at = ?"); binds.push(now);

  // If stage is transitioning to closed_* and closed_at is null, set it
  if (body.stage === "closed_won" || body.stage === "closed_lost") {
    fields.push("closed_at = COALESCE(closed_at, ?)"); binds.push(now);
  }
  // If stage is transitioning back to an open stage, clear closed_at
  if (body.stage !== undefined && !(body.stage === "closed_won" || body.stage === "closed_lost")) {
    fields.push("closed_at = NULL");
  }

  binds.push(did);
  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const res = await db
    .prepare(`UPDATE contact_deals SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
  if (res.meta.changes === 0) return json({ error: "not_found" }, 404);

  const row = await db.prepare("SELECT * FROM contact_deals WHERE id = ?").bind(did).first();
  return json({ deal: row });
};

export const DELETE: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const did = ctx.params.did;
  if (typeof did !== "string" || !did) return json({ error: "missing_did" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const res = await db.prepare("DELETE FROM contact_deals WHERE id = ?").bind(did).run();
  if (res.meta.changes === 0) return json({ error: "not_found" }, 404);
  return json({ ok: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
