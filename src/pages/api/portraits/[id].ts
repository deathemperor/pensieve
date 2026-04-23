import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { getContact, updateContact, softDeleteContact, type UpdateContactInput } from "../../../lib/portraits/db";
import type { TierCode } from "../../../lib/portraits/types";

export const prerender = false;

const TIERS: TierCode[] = ["S", "A", "B", "C", "D"];

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
    headers: { "Content-Type": "application/json", "Cache-Control": cacheHeader },
  });
};

export const PATCH: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (!id || typeof id !== "string") return json({ error: "missing_id" }, 400);

  let body: UpdateContactInput;
  try { body = await ctx.request.json() as UpdateContactInput; }
  catch { return json({ error: "invalid_json" }, 400); }

  // Guard against editing placeholder rows via API
  const existing = await getContact((env as any).DB, id);
  if (!existing) return json({ error: "not_found" }, 404);
  if (existing.is_placeholder === 1) return json({ error: "cannot_edit_placeholder" }, 403);

  // Validate any provided fields
  if (body.prestige_tier !== undefined && !TIERS.includes(body.prestige_tier)) {
    return json({ error: "invalid_prestige_tier" }, 400);
  }
  if (body.tier_score !== undefined && (typeof body.tier_score !== "number" || body.tier_score < 0 || body.tier_score > 100)) {
    return json({ error: "invalid_tier_score" }, 400);
  }
  if (body.full_name !== undefined && (typeof body.full_name !== "string" || !body.full_name.trim())) {
    return json({ error: "full_name_must_be_non_empty_string" }, 400);
  }

  const db = (env as any).DB;
  const updated = await updateContact(db, id, body);
  if (!updated) return json({ error: "not_found" }, 404);
  return json({ contact: updated });
};

export const DELETE: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (!id || typeof id !== "string") return json({ error: "missing_id" }, 400);

  // Guard against deleting placeholder rows
  const db = (env as any).DB;
  const existing = await getContact(db, id);
  if (!existing) return json({ error: "not_found" }, 404);
  if (existing.is_placeholder === 1) return json({ error: "cannot_delete_placeholder" }, 403);

  const ok = await softDeleteContact(db, id);
  if (!ok) return json({ error: "not_found_or_already_deleted" }, 404);
  return json({ ok: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
