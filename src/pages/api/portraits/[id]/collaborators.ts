import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { ulid } from "../../../../lib/portraits/ulid";

export const prerender = false;

interface PostBody { email?: string; access?: "view" | "edit" }

// Grant a collaborator on a contact -- admin-only operation.
export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  let body: PostBody;
  try { body = await ctx.request.json() as PostBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (typeof body.email !== "string" || !body.email.includes("@")) return json({ error: "invalid_email" }, 400);
  if (body.access !== "view" && body.access !== "edit") return json({ error: "invalid_access" }, 400);
  const email = body.email.toLowerCase().trim();
  if (email === auth.user?.email?.toLowerCase().trim()) return json({ error: "cannot_grant_self" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const now = new Date().toISOString();
  const grantId = ulid();
  try {
    await db
      .prepare(`INSERT INTO contact_collaborators (id, contact_id, email, access, granted_by, created_at) VALUES (?,?,?,?,?,?)`)
      .bind(grantId, id, email, body.access, auth.user?.email ?? "unknown", now)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Upsert behavior: if already granted, update access.
    if (msg.includes("UNIQUE")) {
      await db
        .prepare(`UPDATE contact_collaborators SET access = ? WHERE contact_id = ? AND email = ?`)
        .bind(body.access, id, email)
        .run();
      return json({ ok: true, updated: true, email, access: body.access });
    }
    return json({ error: `grant_failed: ${msg}` }, 500);
  }
  return json({ ok: true, id: grantId, email, access: body.access }, 201);
};

// List collaborators on this contact (admin-only, to avoid leaking who else has access).
export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT id, email, access, granted_by, created_at FROM contact_collaborators WHERE contact_id = ? ORDER BY created_at DESC")
    .bind(id)
    .all();
  return json({ collaborators: rs.results ?? [] });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
