import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { findIntroPaths } from "../../../lib/portraits/paths";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  const maxHops = Math.min(Math.max(parseInt(url.searchParams.get("maxHops") ?? "3", 10), 1), 5);

  if (!from || !to) return json({ error: "from_and_to_required" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const paths = await findIntroPaths(db, from, to, maxHops);
  return json({ paths });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
