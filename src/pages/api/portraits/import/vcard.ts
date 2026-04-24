import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { parseVCard } from "../../../../lib/portraits/vcard";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const text = await ctx.request.text();
  if (!text.trim()) return json({ error: "empty_body" }, 400);

  const parsed = parseVCard(text);
  if (parsed.length === 0) return json({ contacts: [], skipped: 0 });
  if (parsed.length > 2000) return json({ error: "too_many_contacts", max: 2000 }, 413);

  // Dedup preview — mark contacts whose email already exists in DB
  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const allEmails = Array.from(new Set(parsed.flatMap((c) => c.emails.map((e) => e.toLowerCase()))));
  const existingByEmail = new Set<string>();

  if (allEmails.length > 0) {
    // SQLite has parameter limits — chunk by 100
    for (let i = 0; i < allEmails.length; i += 100) {
      const chunk = allEmails.slice(i, i + 100);
      const placeholders = chunk.map(() => "?").join(",");
      const rs = await db
        .prepare(`SELECT LOWER(value) AS v FROM contact_channels WHERE kind='email' AND LOWER(value) IN (${placeholders})`)
        .bind(...chunk)
        .all<{ v: string }>();
      for (const r of (rs.results ?? [])) existingByEmail.add(r.v);
    }
  }

  const contacts = parsed.map((c) => ({
    ...c,
    dedup: c.emails.some((e) => existingByEmail.has(e.toLowerCase())) ? "existing" as const : "new" as const,
  }));

  return json({ contacts });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
