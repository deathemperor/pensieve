import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { listContacts, createContact } from "../../../lib/portraits/db";
import type { CreateContactInput, TierCode } from "../../../lib/portraits/types";

export const prerender = false;

const TIERS: TierCode[] = ["S", "A", "B", "C", "D"];

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  const db = (env as any).DB;

  const url = new URL(ctx.request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const tiersParam = url.searchParams.get("tiers");
  const tiers = tiersParam
    ? (tiersParam.split(",").filter((t) => TIERS.includes(t as TierCode)) as TierCode[])
    : undefined;

  if (!auth.admin) {
    // Guest: placeholders only, no filters honored (keep demo stable)
    const contacts = await listContacts(db, {
      includePlaceholders: true,
      onlyPlaceholders: true,
    });
    return json(
      { contacts, guest: true },
      { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    );
  }

  const contacts = await listContacts(db, {
    includePlaceholders: false,
    onlyPlaceholders: false,
    search,
    tiers,
  });
  return json({ contacts, guest: false }, { "Cache-Control": "private, no-store" });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) {
    return json({ error: "forbidden" }, {}, 403);
  }

  let input: CreateContactInput;
  try {
    input = (await ctx.request.json()) as CreateContactInput;
  } catch {
    return json({ error: "invalid_json" }, {}, 400);
  }

  const err = validateCreate(input);
  if (err) return json({ error: err }, {}, 400);

  const db = (env as any).DB;
  const created = await createContact(db, input);
  return json({ contact: created }, { "Cache-Control": "private, no-store" }, 201);
};

function validateCreate(i: unknown): string | null {
  if (!i || typeof i !== "object") return "invalid_body";
  const o = i as Record<string, unknown>;
  if (typeof o.full_name !== "string" || !o.full_name.trim()) return "full_name_required";
  if (!TIERS.includes(o.prestige_tier as TierCode)) return "invalid_prestige_tier";
  if (
    o.tier_score !== undefined &&
    (typeof o.tier_score !== "number" || o.tier_score < 0 || o.tier_score > 100)
  ) {
    return "invalid_tier_score";
  }
  return null;
}

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
