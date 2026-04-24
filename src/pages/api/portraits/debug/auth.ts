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

  // 2. Astro.session — Astro's native session API
  let sessionUser: unknown = null;
  let sessionError: string | null = null;
  try {
    const session = (ctx as any).session;
    if (session) {
      const keys = ["user", "auth", "emdash_user", "emdash:user", "authUser"];
      const results: Record<string, unknown> = {};
      for (const k of keys) {
        try {
          const v = await session.get(k);
          if (v) results[k] = typeof v === "object" ? { keys: Object.keys(v), role: (v as any).role } : typeof v;
        } catch { /* skip */ }
      }
      sessionUser = Object.keys(results).length > 0 ? results : null;
    } else {
      sessionUser = "ctx.session undefined";
    }
  } catch (e) {
    sessionError = e instanceof Error ? e.message : String(e);
  }
  out.sessionProbe = sessionUser;
  out.sessionError = sessionError;

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
