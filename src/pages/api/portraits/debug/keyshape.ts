import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Temporary — reports the safe shape of ANTHROPIC_API_KEY so we can
// confirm OAuth detection works. Shows only first 14 chars + length.
export const GET: APIRoute = async (ctx) => {
  const u = (ctx as any)?.locals?.user;
  if (!u || u.role < 50) return new Response("forbidden", { status: 403 });

  const k = (env as any).ANTHROPIC_API_KEY as string | undefined;
  const out = {
    present: !!k,
    length: k?.length ?? 0,
    prefix14: k?.slice(0, 14) ?? null,
    isOAuthByOatPrefix: k?.startsWith("sk-ant-oat") ?? false,
    isApiByApiPrefix: k?.startsWith("sk-ant-api") ?? false,
  };
  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
};
