import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { matchCandidates, normalizePhone, type Candidate } from "../../../../../lib/portraits/dedup";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();
  const phone = url.searchParams.get("phone")?.trim();

  if (!email && !phone) return json({ matches: [] });

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const valueHits = new Set<string>();

  if (email) {
    const rs = await db.prepare("SELECT DISTINCT contact_id FROM contact_channels WHERE kind='email' AND LOWER(value)=?").bind(email).all<{ contact_id: string }>();
    for (const r of (rs.results ?? [])) valueHits.add(r.contact_id);
  }
  if (phone) {
    // Use the indexed normalized_value column (Phase 14 migration).
    const tail10 = phone.replace(/[^\d]/g, "").slice(-10);
    if (tail10) {
      const rs = await db
        .prepare("SELECT DISTINCT contact_id FROM contact_channels WHERE kind='phone' AND normalized_value = ?")
        .bind(tail10)
        .all<{ contact_id: string }>();
      for (const r of (rs.results ?? [])) valueHits.add(r.contact_id);
    }
  }

  if (valueHits.size === 0) return json({ matches: [] });

  const idList = Array.from(valueHits);
  const placeholders = idList.map(() => "?").join(",");
  const contactsRs = await db
    .prepare(`SELECT id, full_name, company FROM contacts WHERE id IN (${placeholders}) AND is_placeholder=0 AND deleted_at IS NULL`)
    .bind(...idList)
    .all<{ id: string; full_name: string; company: string | null }>();

  // Single query for all channels across all candidate contacts (was N+1 before).
  const channelsByContact = new Map<string, { emails: string[]; phones: string[] }>();
  if (idList.length > 0) {
    const chRs = await db
      .prepare(`SELECT contact_id, kind, value FROM contact_channels WHERE contact_id IN (${placeholders}) AND kind IN ('email','phone')`)
      .bind(...idList)
      .all<{ contact_id: string; kind: string; value: string }>();
    for (const r of (chRs.results ?? []) as Array<{ contact_id: string; kind: string; value: string }>) {
      const bucket = channelsByContact.get(r.contact_id) ?? { emails: [], phones: [] };
      if (r.kind === "email") bucket.emails.push(r.value);
      else if (r.kind === "phone") bucket.phones.push(r.value);
      channelsByContact.set(r.contact_id, bucket);
    }
  }

  const candidates: Candidate[] = ((contactsRs.results ?? []) as Array<{ id: string; full_name: string; company: string | null }>).map((c) => {
    const ch = channelsByContact.get(c.id) ?? { emails: [], phones: [] };
    return { id: c.id, name: c.full_name, emails: ch.emails, phones: ch.phones };
  });

  const results = matchCandidates(candidates, {
    emails: email ? [email] : [],
    phones: phone ? [phone] : [],
  });
  const byId = new Map(contactsRs.results?.map((c) => [c.id, c]) ?? []);
  return json({
    matches: results.map((r) => ({
      id: r.id,
      full_name: byId.get(r.id)?.full_name ?? "—",
      company: byId.get(r.id)?.company ?? null,
      reason: r.reason,
    })),
  });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
