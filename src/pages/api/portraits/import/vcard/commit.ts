import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { createContact } from "../../../../../lib/portraits/db";
import type { TierCode } from "../../../../../lib/portraits/types";

export const prerender = false;

interface CommitBody {
  contacts: Array<{
    full_name: string;
    title?: string | null;
    company?: string | null;
    emails: string[];
    phones: string[];
    prestige_tier?: TierCode;
    skip?: boolean;
  }>;
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: CommitBody;
  try { body = await ctx.request.json() as CommitBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!Array.isArray(body.contacts)) return json({ error: "contacts_required" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const created: string[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < body.contacts.length; i++) {
    const c = body.contacts[i];
    if (c.skip) continue;
    if (typeof c.full_name !== "string" || !c.full_name.trim()) {
      errors.push({ index: i, error: "full_name_required" });
      continue;
    }

    try {
      const channels = [
        ...c.emails.map((v, ix) => ({ kind: "email" as const, value: v, is_primary: ix === 0 })),
        ...c.phones.map((v) => ({ kind: "phone" as const, value: v, is_primary: false })),
      ];
      const row = await createContact(db, {
        full_name: c.full_name,
        title: c.title ?? null,
        company: c.company ?? null,
        prestige_tier: c.prestige_tier ?? "D",
        source: "ios", // vCard comes from iOS / iCloud / Google export — closest canonical match
        channels,
      });
      created.push(row.id);
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ created_count: created.length, created_ids: created, errors });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
