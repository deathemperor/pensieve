import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

interface CardRow {
  id: string;
  contact_id: string | null;
  r2_key: string;
  captured_at: string;
  ocr_status: "pending" | "parsing" | "parsed" | "failed";
  ocr_provider: string | null;
  extracted: string | null;
  error: string | null;
}

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const row = await db
    .prepare("SELECT id, contact_id, r2_key, captured_at, ocr_status, ocr_provider, extracted, error FROM contact_cards WHERE id=?")
    .bind(id)
    .first<CardRow>();
  if (!row) return json({ error: "not_found" }, 404);

  const extracted = row.extracted ? JSON.parse(row.extracted) : null;
  return json({ card: { ...row, extracted } });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
