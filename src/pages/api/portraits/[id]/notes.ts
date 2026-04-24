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
    .prepare("SELECT id, body, encrypted, salt, iv, created_at, updated_at FROM contact_notes WHERE contact_id=? ORDER BY created_at DESC")
    .bind(id)
    .all();
  return json({ notes: rs.results ?? [] });
};

interface PostBody {
  body?: string;
  encrypted?: boolean;
  salt?: string;
  iv?: string;
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: PostBody;
  try { body = await ctx.request.json() as PostBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (typeof body.body !== "string" || !body.body.trim()) return json({ error: "body_required" }, 400);

  const isEncrypted = body.encrypted === true;
  if (isEncrypted) {
    if (typeof body.salt !== "string" || !/^[0-9a-f]{32}$/i.test(body.salt)) return json({ error: "invalid_salt" }, 400);
    if (typeof body.iv !== "string" || !/^[0-9a-f]{24}$/i.test(body.iv)) return json({ error: "invalid_iv" }, 400);
    if (!/^[0-9a-f]+$/i.test(body.body)) return json({ error: "invalid_ciphertext" }, 400);
  }

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_notes (id, contact_id, body, encrypted, salt, iv, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(
      id,
      contact_id,
      body.body.trim(),
      isEncrypted ? 1 : 0,
      isEncrypted ? body.salt : null,
      isEncrypted ? body.iv : null,
      now,
      now,
    )
    .run();
  return json({
    note: {
      id, contact_id,
      body: body.body.trim(),
      encrypted: isEncrypted ? 1 : 0,
      salt: isEncrypted ? body.salt : null,
      iv: isEncrypted ? body.iv : null,
      created_at: now,
      updated_at: now,
    },
  }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
