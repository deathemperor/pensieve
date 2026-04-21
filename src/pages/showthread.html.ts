// src/pages/showthread.html.ts
// Legacy: /showthread.html?t=<id> -> /hol/t/<id>-<slug>/
import type { APIRoute } from "astro";
import { getHolDb } from "../lib/hol/db";
import { getThread } from "../lib/hol/queries";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const t = url.searchParams.get("t");
  const id = t ? parseInt(t, 10) : NaN;
  if (!Number.isFinite(id)) return Response.redirect(new URL("/hol/", url), 302);

  const db = getHolDb();
  const thread = await getThread(db, id);
  if (!thread) return Response.redirect(new URL("/hol/", url), 302);

  return Response.redirect(
    new URL(`/hol/t/${thread.id}-${thread.title_slug}/`, url), 301,
  );
};
