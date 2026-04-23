import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createContact } from "../../../lib/portraits/db";
import type { CreateContactInput, TierCode } from "../../../lib/portraits/types";
import { rateLimit, rateLimitResponse, hashBearer } from "../../../lib/portraits/rate-limit";

export const prerender = false;

// Bearer-token auth (for openclaw / iOS Shortcuts / any external ingestor).
// Admin session is NOT checked — the bearer token IS the credential.
function verifyBearer(request: Request, secret: string): boolean {
  const h = request.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return false;
  const provided = h.slice(7);
  // Constant-time compare. Always iterate max(provided, secret) length so
  // timing doesn't leak length; OR the length inequality into the result.
  const maxLen = Math.max(provided.length, secret.length);
  let diff = provided.length ^ secret.length;
  for (let i = 0; i < maxLen; i++) {
    const pc = i < provided.length ? provided.charCodeAt(i) : 0;
    const sc = i < secret.length ? secret.charCodeAt(i) : 0;
    diff |= pc ^ sc;
  }
  return diff === 0;
}

interface IngestBody {
  source: "openclaw" | "shortcut" | "manual" | "card";
  contact: CreateContactInput;
  card_r2_key?: string;
  idempotency_key?: string; // optional — external system's unique ID
}

export const POST: APIRoute = async (ctx) => {
  const secret = (env as any).PORTRAITS_INGEST_TOKEN as string | undefined;
  if (!secret) {
    return json({ error: "ingest_disabled", hint: "set PORTRAITS_INGEST_TOKEN via wrangler secret" }, 503);
  }
  if (!verifyBearer(ctx.request, secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  // Rate-limit by bearer-token hash — one token = one bucket.
  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const identity = await hashBearer(secret);
  const rl = await rateLimit(db, "ingest", identity);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: IngestBody;
  try { body = await ctx.request.json() as IngestBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!body.contact || typeof body.contact.full_name !== "string" || !body.contact.full_name.trim()) {
    return json({ error: "contact.full_name_required" }, 400);
  }
  const TIERS: TierCode[] = ["S","A","B","C","D"];
  if (!TIERS.includes(body.contact.prestige_tier)) {
    return json({ error: "contact.prestige_tier_invalid" }, 400);
  }

  // Idempotency: fast path — if a row already exists with this key, return it.
  // Race safety: regardless of this check, a UNIQUE index on
  // json_extract(external_ids, '$.ingest_idempotency_key') (migration 003)
  // guarantees the INSERT below fails on concurrent dup requests.
  if (body.idempotency_key) {
    const existing = await db
      .prepare(
        "SELECT id FROM contacts WHERE json_extract(external_ids, '$.ingest_idempotency_key')=? AND deleted_at IS NULL",
      )
      .bind(body.idempotency_key)
      .first<{ id: string }>();
    if (existing) return json({ ok: true, contact_id: existing.id, created: false });
  }

  const external_ids = body.idempotency_key
    ? JSON.stringify({ ingest_idempotency_key: body.idempotency_key })
    : undefined;

  let createdId: string;
  try {
    const created = await createContact(db, {
      ...body.contact,
      source: body.source ?? "openclaw",
    });
    createdId = created.id;

    if (external_ids) {
      await db.prepare("UPDATE contacts SET external_ids=? WHERE id=?").bind(external_ids, created.id).run();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Concurrent dup hit the UNIQUE index — re-read and return the winner.
    if (body.idempotency_key && (msg.includes("UNIQUE") || msg.includes("constraint"))) {
      const winner = await db
        .prepare(
          "SELECT id FROM contacts WHERE json_extract(external_ids, '$.ingest_idempotency_key')=? AND deleted_at IS NULL",
        )
        .bind(body.idempotency_key)
        .first<{ id: string }>();
      if (winner) return json({ ok: true, contact_id: winner.id, created: false });
    }
    return json({ error: `ingest_failed: ${msg}` }, 500);
  }

  // Optionally link a captured card
  if (body.card_r2_key) {
    await db
      .prepare("UPDATE contact_cards SET contact_id=? WHERE r2_key=?")
      .bind(createdId, body.card_r2_key)
      .run();
  }

  return json({ ok: true, contact_id: createdId, created: true }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
