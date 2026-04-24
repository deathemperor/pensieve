import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// Temporary diagnostic endpoint — reports exactly what the server sees
// during the admin-auth proxy flow. DELETE after debugging PR lands.

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const cookie = ctx.request.headers.get("cookie") ?? "";

  const out: Record<string, unknown> = {
    receivedCookieLength: cookie.length,
    cookieNames: cookie.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean),
    url: ctx.request.url,
  };

  // Reproduce the requireAdmin proxy fetch
  let proxyStatus: number | null = null;
  let proxyBody: unknown = null;
  let proxyError: string | null = null;

  try {
    const url = new URL("/_emdash/api/auth/me", ctx.request.url).href;
    out.proxyFetchUrl = url;
    const res = await fetch(url, { headers: { cookie } });
    proxyStatus = res.status;
    try {
      proxyBody = await res.json();
    } catch {
      proxyBody = await res.text().catch(() => "<unreadable>");
    }
  } catch (e) {
    proxyError = e instanceof Error ? e.message : String(e);
  }

  out.proxyStatus = proxyStatus;
  out.proxyBody = proxyBody;
  out.proxyError = proxyError;

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
};
