import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return new Response("forbidden", { status: 403 });

  const url = new URL(ctx.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return new Response(`Google OAuth error: ${err}`, { status: 400 });
  if (!code || !state) return new Response("missing code or state", { status: 400 });

  const e = env as any;
  const kv = e.SESSION as import("@cloudflare/workers-types").KVNamespace;

  // Verify state
  const stored = await kv.get(`portraits:oauth:google:state:${state}`);
  if (!stored) return new Response("invalid or expired state", { status: 400 });
  await kv.delete(`portraits:oauth:google:state:${state}`);

  const clientId = e.GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = e.GOOGLE_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) return new Response("google oauth not configured", { status: 503 });

  const redirect = `${url.origin}/api/portraits/integrations/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => "");
    return new Response(`token exchange failed: ${tokenRes.status} ${txt}`, { status: 502 });
  }
  const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number };

  if (!tokens.refresh_token) {
    return new Response(
      "Google did not return a refresh_token. Revoke the app's access at https://myaccount.google.com/permissions then retry so the consent screen re-appears (access_type=offline + prompt=consent).",
      { status: 400 },
    );
  }

  // Store the refresh token. Access tokens are short-lived and refetched per sync.
  await kv.put("portraits:integration:google:refresh", tokens.refresh_token);
  await kv.put("portraits:integration:google:connected_at", new Date().toISOString());

  return Response.redirect(`${url.origin}/room-of-requirement/portraits/sync?google=connected`, 302);
};
