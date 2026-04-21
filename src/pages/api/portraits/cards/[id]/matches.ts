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
    const normalized = normalizePhone(phone);
    const rs = await db.prepare("SELECT contact_id, value FROM contact_channels WHERE kind='phone'").all<{ contact_id: string; value: string }>();
    for (const r of (rs.results ?? [])) {
      if (normalizePhone(r.value) === normalized) valueHits.add(r.contact_id);
    }
  }

  if (valueHits.size === 0) return json({ matches: [] });

  const placeholders = Array.from(valueHits).map(() => "?").join(",");
  const contactsRs = await db
    .prepare(`SELECT id, full_name, company FROM contacts WHERE id IN (${placeholders}) AND is_placeholder=0 AND deleted_at IS NULL`)
    .bind(...valueHits)
    .all<{ id: string; full_name: string; company: string | null }>();

  const candidates: Candidate[] = [];
  for (const c of contactsRs.results ?? []) {
    const chs = await db.prepare("SELECT kind, value FROM contact_channels WHERE contact_id=?").bind(c.id).all<{ kind: string; value: string }>();
    candidates.push({
      id: c.id,
      name: c.full_name,
      emails: (chs.results ?? []).filter((x) => x.kind === "email").map((x) => x.value),
      phones: (chs.results ?? []).filter((x) => x.kind === "phone").map((x) => x.value),
    });
  }

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
