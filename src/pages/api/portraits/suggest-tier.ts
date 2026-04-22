import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { suggestTier } from "../../../lib/portraits/tier-suggest";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: { full_name?: string; title?: string; company?: string; bio?: string };
  try { body = await ctx.request.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  if (typeof body.full_name !== "string" || !body.full_name.trim()) {
    return json({ error: "full_name_required" }, 400);
  }

  const apiKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return json({ error: "unavailable", hint: "set ANTHROPIC_API_KEY" }, 503);

  const result = await suggestTier(apiKey, body as any);
  if (!result.ok) return json({ error: result.error }, 502);
  return json({ tier: result.tier, reason: result.reason });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
