import type { APIRoute } from "astro";

// Temporary diagnostic endpoint — reports what session surfaces are available.
// DELETE after root cause is found.

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const cookie = ctx.request.headers.get("cookie") ?? "";

  const out: Record<string, unknown> = {
    receivedCookieLength: cookie.length,
    cookieNames: cookie.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean),
    url: ctx.request.url,
  };

  // 1. Astro.locals — does EmDash middleware populate user?
  const locals = (ctx as any).locals;
  out.localsKeys = locals ? Object.keys(locals) : [];
  out.localsUser = locals?.user ? { role: locals.user.role, hasEmail: !!locals.user.email, keys: Object.keys(locals.user) } : null;
  out.localsHasRuntime = !!locals?.runtime;
  out.localsRuntimeEnvKeys = locals?.runtime?.env ? Object.keys(locals.runtime.env).slice(0, 40) : [];

  // 2. Astro.session — may not exist if not configured
  try {
    const session = (ctx as any).session;
    out.sessionExists = !!session;
    if (session) {
      try {
        const u = await session.get("user");
        out.sessionUser = u ? { keys: Object.keys(u), role: (u as any).role } : null;
      } catch (e) {
        out.sessionGetError = e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    out.sessionOuterError = e instanceof Error ? e.message : String(e);
  }

  // 3. Proxy fetch — already known to 522 but confirm status
  let proxyStatus: number | null = null;
  let proxyError: string | null = null;
  try {
    const url = new URL("/_emdash/api/auth/me", ctx.request.url).href;
    const res = await fetch(url, { headers: { cookie } });
    proxyStatus = res.status;
  } catch (e) {
    proxyError = e instanceof Error ? e.message : String(e);
  }
  out.proxyStatus = proxyStatus;
  out.proxyError = proxyError;

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
};
