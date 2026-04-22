import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

const KINDS = ["met", "call", "email_sent", "email_received", "note", "deal", "intro"] as const;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT id, kind, body, happened_at, metadata, created_at FROM contact_interactions WHERE contact_id=? ORDER BY happened_at DESC")
    .bind(id)
    .all();
  return json({ interactions: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: { kind?: string; body?: string; happened_at?: string; metadata?: unknown };
  try { body = await ctx.request.json() as any; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!KINDS.includes(body.kind as any)) return json({ error: "invalid_kind", allowed: KINDS }, 400);
  if (body.body !== undefined && typeof body.body !== "string") return json({ error: "body_must_be_string" }, 400);
  const happened_at = typeof body.happened_at === "string" ? body.happened_at : new Date().toISOString();

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_interactions (id, contact_id, kind, body, happened_at, metadata, created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(
      id, contact_id, body.kind, body.body ?? null, happened_at,
      body.metadata !== undefined ? JSON.stringify(body.metadata) : null, now,
    )
    .run();
  return json({ interaction: { id, contact_id, kind: body.kind, body: body.body ?? null, happened_at, metadata: body.metadata ?? null, created_at: now } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "", t = now;
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  let rs = "", bits = 0, acc = 0;
  for (let i = 0; i < 10; i++) { acc = (acc << 8) | rand[i]; bits += 8; while (bits >= 5) { bits -= 5; rs += CROCKFORD[(acc >> bits) & 31]; } }
  return time + rs;
}
