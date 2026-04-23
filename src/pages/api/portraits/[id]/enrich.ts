import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { getContact } from "../../../../lib/portraits/db";
import { ulid } from "../../../../lib/portraits/ulid";
import { buildQuery, searchGoogleCse } from "../../../../lib/portraits/enrich";
import { rateLimit, rateLimitResponse } from "../../../../lib/portraits/rate-limit";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const e = env as any;

  // Rate-limit by admin email — CSE free tier is 100/day, 30/hour gives headroom.
  const db = e.DB as import("@cloudflare/workers-types").D1Database;
  const rl = await rateLimit(db, "enrich", auth.user?.email ?? "unknown");
  if (!rl.ok) return rateLimitResponse(rl);
  const apiKey = e.GOOGLE_CSE_API_KEY as string | undefined;
  const cseId = e.GOOGLE_CSE_ID as string | undefined;
  if (!apiKey || !cseId) {
    return json({ error: "cse_unavailable", hint: "set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID via wrangler secret" }, 503);
  }

  const contact = await getContact(db, id);
  if (!contact) return json({ error: "not_found" }, 404);
  if (contact.is_placeholder === 1) return json({ error: "cannot_enrich_placeholder" }, 403);

  const query = buildQuery(contact.full_name, contact.company);
  const result = await searchGoogleCse(apiKey, cseId, query, 10);
  if (!result.ok) return json({ error: (result as { ok: false; error: string }).error }, 502);

  // Upsert: UNIQUE(contact_id, url) turns dups into a silent no-op (INSERT OR IGNORE).
  const now = new Date().toISOString();
  let inserted = 0;
  for (const r of result.value) {
    const res = await db
      .prepare(`
        INSERT OR IGNORE INTO contact_mentions
          (id, contact_id, title, url, source, snippet, published_at, fetched_at, query)
        VALUES (?,?,?,?,?,?,?,?,?)
      `)
      .bind(ulid(), id, r.title, r.url, r.source, r.snippet, r.published_at, now, query)
      .run();
    if (res.meta.changes > 0) inserted++;
  }

  return json({ ok: true, query, fetched: result.value.length, inserted });
};

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT id, title, url, source, snippet, published_at, fetched_at
      FROM contact_mentions
      WHERE contact_id = ?
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT 50
    `)
    .bind(id)
    .all();
  return json({ mentions: rs.results ?? [] });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
