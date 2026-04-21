import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { getContact } from "../../../lib/portraits/db";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const id = ctx.params.id;
  if (!id || typeof id !== "string") {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await requireAdmin(ctx as any);
  const db = (env as any).DB;
  const contact = await getContact(db, id);

  if (!contact) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guests can read placeholder rows only; everything else is 404 to avoid leaking existence.
  if (!auth.admin && contact.is_placeholder !== 1) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheHeader =
    !auth.admin && contact.is_placeholder === 1
      ? "public, max-age=3600, s-maxage=3600"
      : "private, no-store";

  return new Response(JSON.stringify({ contact }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheHeader,
    },
  });
};
