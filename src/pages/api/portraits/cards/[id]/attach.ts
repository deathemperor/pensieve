import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { createContact, getContact } from "../../../../../lib/portraits/db";
import type { CreateContactInput, TierCode } from "../../../../../lib/portraits/types";

export const prerender = false;

interface AttachBody {
  contact_id?: string;
  create?: CreateContactInput;
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  let body: AttachBody;
  try { body = await ctx.request.json() as AttachBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!body.contact_id && !body.create) {
    return json({ error: "must_provide_contact_id_or_create" }, 400);
  }

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;

  let targetContactId: string;
  if (body.contact_id) {
    const existing = await getContact(db, body.contact_id);
    if (!existing) return json({ error: "contact_not_found" }, 404);
    targetContactId = existing.id;
  } else {
    const TIERS: TierCode[] = ["S","A","B","C","D"];
    const create = body.create!;
    if (typeof create.full_name !== "string" || !create.full_name.trim()) {
      return json({ error: "full_name_required" }, 400);
    }
    if (!TIERS.includes(create.prestige_tier)) {
      return json({ error: "invalid_prestige_tier" }, 400);
    }
    const created = await createContact(db, { ...create, source: "card" });
    targetContactId = created.id;
  }

  const res = await db.prepare("UPDATE contact_cards SET contact_id=? WHERE id=?").bind(targetContactId, id).run();
  if (res.meta.changes === 0) return json({ error: "card_not_found" }, 404);

  return json({ card_id: id, contact_id: targetContactId });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
