import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

const SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return new Response("forbidden", { status: 403 });

  const e = env as any;
  const clientId = e.GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  if (!clientId) {
    return new Response("GOOGLE_OAUTH_CLIENT_ID not configured. See /room-of-requirement/portraits/sync.", { status: 503 });
  }

  // CSRF: random state, stashed in KV with 10min TTL.
  const state = crypto.randomUUID();
  const kv = e.SESSION as import("@cloudflare/workers-types").KVNamespace;
  await kv.put(`portraits:oauth:google:state:${state}`, "1", { expirationTtl: 600 });

  const redirect = `${new URL(ctx.request.url).origin}/api/portraits/integrations/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
