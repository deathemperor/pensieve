import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

export const DELETE: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const cid = ctx.params.cid;
  if (typeof cid !== "string" || !cid) return json({ error: "missing_cid" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const res = await db.prepare("DELETE FROM contact_collaborators WHERE id = ?").bind(cid).run();
  if (res.meta.changes === 0) return json({ error: "not_found" }, 404);
  return json({ ok: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
