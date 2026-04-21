// src/pages/forumdisplay.html.ts
// Legacy: /forumdisplay.html?f=<id> -> /hol/f/<id>-<slug>/
import type { APIRoute } from "astro";
import { getHolDb } from "../lib/hol/db";
import { getForum } from "../lib/hol/queries";
import { viSlug } from "../lib/hol/slug";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const f = url.searchParams.get("f");
  const id = f ? parseInt(f, 10) : NaN;
  if (!Number.isFinite(id)) return Response.redirect(new URL("/hol/", url), 302);

  const db = getHolDb();
  const forum = await getForum(db, id);
  if (!forum) return Response.redirect(new URL("/hol/", url), 302);

  return Response.redirect(
    new URL(`/hol/f/${forum.id}-${viSlug(forum.name)}/`, url), 301,
  );
};
