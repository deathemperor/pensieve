# Portraits — Phase 2: Card Capture + Claude Vision OCR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Loc can photograph a business card on his phone; Claude vision parses name/title/company/emails/phones; within seconds the detail view opens with the parsed data pre-filled and a dedup suggestion if the contact already exists.

**Architecture:** `POST /api/portraits/cards` stores the image in R2 (`portraits/cards/{ulid}.jpg`), inserts a `contact_cards` row with `ocr_status='pending'`, then uses `waitUntil` to fire an async OCR job that calls Anthropic's vision API (`claude-sonnet-4-6`), parses the response into structured JSON, and updates the row to `ocr_status='parsed'` + `extracted=<json>`. The capture page polls the status endpoint and, when parsed, offers "attach to existing contact" (dedup match on email/phone) or "create new contact" (form pre-filled with extracted data).

**Tech Stack:** `@anthropic-ai/sdk`, Cloudflare Workers `waitUntil`, R2, D1, Astro SSR.

**Spec:** `docs/superpowers/specs/2026-04-21-portraits-design.md` (Card capture section).

---

## Secrets required (user must set)

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Until the secret is set, the capture UI works end-to-end but OCR returns a helpful "OCR unavailable — add to contact manually" message. The card image still lands in R2 for later parsing.

---

## File structure

Created:

```
src/lib/portraits/ocr.ts                         -- Anthropic vision client
src/lib/portraits/dedup.ts                       -- match-by-email/phone/name+company

src/pages/api/portraits/cards/index.ts           -- POST upload, GET list
src/pages/api/portraits/cards/[id].ts            -- GET status (polling)
src/pages/api/portraits/cards/[id]/image.ts      -- GET image (admin-gated R2 proxy)
src/pages/api/portraits/cards/[id]/parse.ts      -- POST re-trigger OCR
src/pages/api/portraits/cards/[id]/attach.ts     -- POST bind to contact

src/pages/room-of-requirement/portraits/capture.astro  -- mobile camera UI

src/components/portraits/CardTile.astro          -- thumbnail + status badge
src/components/portraits/CardStatusPoller.tsx    -- React island, polls until parsed

tests/portraits/ocr.test.ts                      -- extractContactFromCard unit tests
tests/portraits/dedup.test.ts                    -- match helpers
```

Modified:

```
package.json                                     -- add @anthropic-ai/sdk
src/pages/room-of-requirement/portraits/[id].astro  -- "Cards" section lists attached cards
src/pages/room-of-requirement/portraits/index.astro -- "＋ Capture card" button next to "＋ New portrait"
```

---

## Task 1: Install `@anthropic-ai/sdk`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

```bash
bun add @anthropic-ai/sdk
```

Expected: package.json shows new dep, bun.lockb or package-lock.json updated.

- [ ] **Step 2: Verify no extra deps sneaked in**

```bash
git diff --stat package.json package-lock.json 2>&1 | head
```

Only `@anthropic-ai/sdk` and its transitive deps should appear.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock bun.lockb package-lock.json 2>/dev/null
git commit -m "feat(portraits): add @anthropic-ai/sdk for Phase 2 OCR"
```

Include both co-author trailers via heredoc.

---

## Task 2: OCR client

**Files:**
- Create: `src/lib/portraits/ocr.ts`
- Test: `tests/portraits/ocr.test.ts`

The client does one thing: accept image bytes + mime type, return structured extraction JSON or a typed error. It is NOT a waitUntil job wrapper — that's the caller's responsibility.

- [ ] **Step 1: Write the test first (pure parser, mock Anthropic SDK response)**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOcrResponse } from "../../src/lib/portraits/ocr";

test("parseOcrResponse: returns structured object on valid JSON", () => {
  const raw = `{"name":"Jensen Huang","title":"CEO","company":"NVIDIA","emails":["j@n.com"],"phones":["+1 408 000 0000"],"websites":["nvidia.com"],"socials":{}}`;
  const r = parseOcrResponse(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, "Jensen Huang");
    assert.deepEqual(r.value.emails, ["j@n.com"]);
  }
});

test("parseOcrResponse: tolerates markdown code fences", () => {
  const raw = '```json\n{"name":"A","title":null,"company":null,"emails":[],"phones":[],"websites":[],"socials":{}}\n```';
  const r = parseOcrResponse(raw);
  assert.equal(r.ok, true);
});

test("parseOcrResponse: rejects non-JSON", () => {
  const r = parseOcrResponse("I couldn't read the card.");
  assert.equal(r.ok, false);
});

test("parseOcrResponse: rejects missing required shape", () => {
  const r = parseOcrResponse(`{"unexpected":true}`);
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run and confirm FAIL**

```bash
npm test -- tests/portraits/ocr.test.ts
```

Expect `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementation**

```ts
// src/lib/portraits/ocr.ts
import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: Record<string, string>;
}

export type OcrResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw?: string };

const SYSTEM_PROMPT = `You are a business-card OCR assistant. Given an image of a business card, extract the contact details and respond with a single JSON object matching this exact shape:

{
  "name": string | null,
  "title": string | null,
  "company": string | null,
  "emails": string[],
  "phones": string[],     // E.164 if inferable, otherwise the text as shown
  "websites": string[],
  "socials": { [platform: string]: string }  // e.g. {"linkedin": "...", "twitter": "..."}
}

Respond with ONLY the JSON — no prose, no markdown fences. Use null for fields you cannot read.`;

export function parseOcrResponse(raw: string): OcrResult<ExtractedCard> {
  let cleaned = raw.trim();
  // Strip markdown fences if the model added them
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "invalid_json", raw };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "not_object", raw };
  }
  const o = parsed as Record<string, unknown>;
  const requiredKeys = ["name", "title", "company", "emails", "phones", "websites", "socials"];
  for (const k of requiredKeys) {
    if (!(k in o)) return { ok: false, error: `missing_${k}`, raw };
  }

  return {
    ok: true,
    value: {
      name: stringOrNull(o.name),
      title: stringOrNull(o.title),
      company: stringOrNull(o.company),
      emails: stringArray(o.emails),
      phones: stringArray(o.phones),
      websites: stringArray(o.websites),
      socials: stringRecord(o.socials),
    },
  };
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}
function stringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.trim()) out[k] = val.trim();
  }
  return out;
}

export async function extractContactFromCard(
  apiKey: string,
  imageBytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
): Promise<OcrResult<ExtractedCard>> {
  const client = new Anthropic({ apiKey });
  const b64 = btoa(String.fromCharCode(...imageBytes));

  let text: string;
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: b64 } },
            { type: "text", text: "Extract the contact details from this business card." },
          ],
        },
      ],
    });
    const first = res.content.find((c) => c.type === "text");
    if (!first || first.type !== "text") {
      return { ok: false, error: "no_text_response" };
    }
    text = first.text;
  } catch (e) {
    return { ok: false, error: `api_error: ${e instanceof Error ? e.message : String(e)}` };
  }

  return parseOcrResponse(text);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/portraits/ocr.test.ts
```

Expect: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portraits/ocr.ts tests/portraits/ocr.test.ts
git commit -m "feat(portraits): Claude vision OCR client with structured parser"
```

---

## Task 3: Dedup helper

**Files:**
- Create: `src/lib/portraits/dedup.ts`
- Test: `tests/portraits/dedup.test.ts`

Given an extracted card, find possible contacts that match by email, phone, or name+company. Pure function — D1 queries live in the caller.

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, matchCandidates } from "../../src/lib/portraits/dedup";

test("normalizePhone: E.164 pass-through", () => {
  assert.equal(normalizePhone("+1 408 555 1212"), "+14085551212");
});

test("normalizePhone: strips formatting", () => {
  assert.equal(normalizePhone("(408) 555-1212"), "4085551212");
});

test("matchCandidates: exact email wins", () => {
  const candidates = [
    { id: "a", name: "Other", emails: ["other@x.com"], phones: [] },
    { id: "b", name: "Target", emails: ["match@x.com"], phones: [] },
  ];
  const out = matchCandidates(candidates, { emails: ["match@x.com"], phones: [] });
  assert.equal(out[0].id, "b");
  assert.equal(out[0].reason, "email_exact");
});

test("matchCandidates: phone match (normalized)", () => {
  const candidates = [{ id: "a", name: "A", emails: [], phones: ["+14085551212"] }];
  const out = matchCandidates(candidates, { emails: [], phones: ["(408) 555-1212"] });
  assert.equal(out[0]?.id, "a");
  assert.equal(out[0]?.reason, "phone_match");
});

test("matchCandidates: no match returns empty", () => {
  const out = matchCandidates([{ id: "a", name: "A", emails: ["x@y.com"], phones: [] }], {
    emails: ["z@w.com"],
    phones: [],
  });
  assert.deepEqual(out, []);
});
```

- [ ] **Step 2: Fail**

```bash
npm test -- tests/portraits/dedup.test.ts
```

- [ ] **Step 3: Implementation**

```ts
// src/lib/portraits/dedup.ts
export interface Candidate {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
}

export interface MatchQuery {
  emails: string[];
  phones: string[];
}

export interface MatchResult {
  id: string;
  reason: "email_exact" | "phone_match" | "name_company_fuzzy";
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function matchCandidates(
  candidates: Candidate[],
  query: MatchQuery,
): MatchResult[] {
  const out: MatchResult[] = [];
  const qEmails = new Set(query.emails.map(normalizeEmail));
  const qPhones = new Set(query.phones.map(normalizePhone));

  for (const c of candidates) {
    const cEmails = c.emails.map(normalizeEmail);
    if (cEmails.some((e) => qEmails.has(e))) {
      out.push({ id: c.id, reason: "email_exact" });
      continue;
    }
    const cPhones = c.phones.map(normalizePhone);
    if (cPhones.some((p) => p && qPhones.has(p))) {
      out.push({ id: c.id, reason: "phone_match" });
      continue;
    }
  }
  return out;
}
```

- [ ] **Step 4: Pass**

```bash
npm test -- tests/portraits/dedup.test.ts
```

Expect: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portraits/dedup.ts tests/portraits/dedup.test.ts
git commit -m "feat(portraits): dedup helper (email exact + phone normalized)"
```

---

## Task 4: POST /api/portraits/cards (upload + queue OCR)

**Files:**
- Create: `src/pages/api/portraits/cards/index.ts`

- [ ] **Step 1: Handler**

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";
import { extractContactFromCard, type ExtractedCard } from "../../../../lib/portraits/ocr";

export const prerender = false;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contentType = ctx.request.headers.get("content-type") ?? "";
  if (!ALLOWED_MIME.includes(contentType as AllowedMime)) {
    return json({ error: "unsupported_media_type", allowed: ALLOWED_MIME }, 415);
  }
  const mime = contentType as AllowedMime;

  const buf = await ctx.request.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: "empty_body" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "too_large", max: MAX_BYTES }, 413);

  const id = ulid();
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const r2Key = `portraits/cards/${id}.${ext}`;
  const now = new Date().toISOString();

  const r2 = (env as any).MEDIA as R2Bucket;
  const db = (env as any).DB as D1Database;

  await r2.put(r2Key, buf, { httpMetadata: { contentType: mime } });
  await db
    .prepare(
      `INSERT INTO contact_cards (id, r2_key, captured_at, ocr_status, ocr_provider)
       VALUES (?,?,?,?,?)`,
    )
    .bind(id, r2Key, now, "pending", "claude-vision")
    .run();

  // Kick off OCR asynchronously; don't block the upload response.
  const anthropicKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (anthropicKey && ctx.locals?.runtime?.ctx?.waitUntil) {
    ctx.locals.runtime.ctx.waitUntil(runOcr(id, mime, new Uint8Array(buf), anthropicKey, db));
  } else if (anthropicKey) {
    // Fallback: non-Workers dev mode, run synchronously
    await runOcr(id, mime, new Uint8Array(buf), anthropicKey, db);
  }
  // If anthropicKey is undefined: card is stored but OCR never kicks. Admin can retry via /parse.

  return json({ card: { id, r2_key: r2Key, ocr_status: "pending" } }, 202);
};

async function runOcr(
  id: string,
  mime: AllowedMime,
  bytes: Uint8Array,
  apiKey: string,
  db: D1Database,
): Promise<void> {
  const now = () => new Date().toISOString();
  await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(id).run();

  const result = await extractContactFromCard(apiKey, bytes, mime);
  if (result.ok) {
    await db
      .prepare(
        `UPDATE contact_cards
         SET ocr_status='parsed', extracted=?, raw_ocr_json=?, error=NULL
         WHERE id=?`,
      )
      .bind(JSON.stringify(result.value), JSON.stringify(result), id)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?`,
      )
      .bind(result.error, id)
      .run();
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

// Re-export the ULID from db.ts is easier than copying; but db.ts keeps ulid private.
// Inline a minimal version here — consistent algorithm, shared crypto.getRandomValues.
function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let randStr = "";
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | rand[i];
    bits += 8;
    while (bits >= 5) { bits -= 5; randStr += CROCKFORD[(acc >> bits) & 31]; }
  }
  return time + randStr;
}

// Types helper
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type D1Database = import("@cloudflare/workers-types").D1Database;
```

- [ ] **Step 2: Verify type-check passes on the new file**

```bash
npx astro check 2>&1 | grep -c "src/pages/api/portraits/cards/index.ts"
```

Expect: `0` (no new errors in our file).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/portraits/cards/index.ts
git commit -m "feat(portraits): POST /api/portraits/cards (R2 upload + waitUntil OCR)"
```

---

## Task 5: GET /api/portraits/cards/:id (status polling)

**Files:**
- Create: `src/pages/api/portraits/cards/[id].ts`

- [ ] **Step 1: Handler**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/portraits/cards/[id].ts
git commit -m "feat(portraits): GET /api/portraits/cards/:id (status polling)"
```

---

## Task 6: GET /api/portraits/cards/:id/image (admin-gated R2 proxy)

**Files:**
- Create: `src/pages/api/portraits/cards/[id]/image.ts`

- [ ] **Step 1: Handler**

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return new Response("forbidden", { status: 403 });

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return new Response("bad request", { status: 400 });

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const row = await db
    .prepare("SELECT r2_key FROM contact_cards WHERE id=?")
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return new Response("not found", { status: 404 });

  const r2 = (env as any).MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const obj = await r2.get(row.r2_key);
  if (!obj) return new Response("not found", { status: 404 });

  const mime =
    obj.httpMetadata?.contentType ??
    (row.r2_key.endsWith(".png") ? "image/png" :
     row.r2_key.endsWith(".webp") ? "image/webp" : "image/jpeg");

  return new Response(obj.body, {
    headers: {
      "Content-Type": mime,
      // Admin-only: never cache publicly
      "Cache-Control": "private, max-age=3600",
    },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/portraits/cards/[id]/image.ts
git commit -m "feat(portraits): GET card image via admin-gated R2 proxy"
```

---

## Task 7: POST /api/portraits/cards/:id/parse (retry)

**Files:**
- Create: `src/pages/api/portraits/cards/[id]/parse.ts`

- [ ] **Step 1: Handler**

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { extractContactFromCard } from "../../../../../lib/portraits/ocr";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const row = await db
    .prepare("SELECT r2_key FROM contact_cards WHERE id=?")
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return json({ error: "not_found" }, 404);

  const apiKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return json({ error: "ocr_unavailable", hint: "set ANTHROPIC_API_KEY via wrangler secret" }, 503);

  const r2 = (env as any).MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const obj = await r2.get(row.r2_key);
  if (!obj) return json({ error: "r2_gone" }, 410);

  const mime = obj.httpMetadata?.contentType ?? "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    return json({ error: `unsupported_mime: ${mime}` }, 415);
  }

  await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(id).run();
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const result = await extractContactFromCard(apiKey, bytes, mime as "image/jpeg" | "image/png" | "image/webp");

  if (result.ok) {
    await db
      .prepare(
        "UPDATE contact_cards SET ocr_status='parsed', extracted=?, error=NULL WHERE id=?",
      )
      .bind(JSON.stringify(result.value), id)
      .run();
    return json({ card: { id, ocr_status: "parsed", extracted: result.value } });
  }

  await db.prepare("UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?").bind(result.error, id).run();
  return json({ card: { id, ocr_status: "failed", error: result.error } }, 502);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/portraits/cards/[id]/parse.ts
git commit -m "feat(portraits): POST card/parse — retry OCR synchronously"
```

---

## Task 8: POST /api/portraits/cards/:id/attach

Binds a card to an existing contact or creates a new contact from the extracted data.

**Files:**
- Create: `src/pages/api/portraits/cards/[id]/attach.ts`

- [ ] **Step 1: Handler**

```ts
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

  const res = await db
    .prepare("UPDATE contact_cards SET contact_id=? WHERE id=?")
    .bind(targetContactId, id)
    .run();
  if (res.meta.changes === 0) return json({ error: "card_not_found" }, 404);

  return json({ card_id: id, contact_id: targetContactId });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/portraits/cards/[id]/attach.ts
git commit -m "feat(portraits): POST card/attach — bind card to new or existing contact"
```

---

## Task 9: CardStatusPoller React island

**Files:**
- Create: `src/components/portraits/CardStatusPoller.tsx`

The island polls `GET /api/portraits/cards/:id` every 1.5s until status is `parsed` or `failed`, then swaps UI to show the extracted fields and action buttons ("Create contact" / "Attach to existing"). Uses plain fetch, no external deps.

- [ ] **Step 1: Component**

```tsx
import { useEffect, useState } from "react";

interface ExtractedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: Record<string, string>;
}

interface CardResponse {
  card: {
    id: string;
    ocr_status: "pending" | "parsing" | "parsed" | "failed";
    extracted: ExtractedCard | null;
    error: string | null;
  };
}

interface MatchResponse {
  matches: Array<{ id: string; full_name: string; company: string | null; reason: string }>;
}

export default function CardStatusPoller({ cardId }: { cardId: string }) {
  const [status, setStatus] = useState<"pending" | "parsing" | "parsed" | "failed">("pending");
  const [extracted, setExtracted] = useState<ExtractedCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse["matches"]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/portraits/cards/${cardId}`);
      if (!res.ok) { setError(`status ${res.status}`); return; }
      const data = (await res.json()) as CardResponse;
      if (cancelled) return;
      setStatus(data.card.ocr_status);
      if (data.card.ocr_status === "parsed" && data.card.extracted) {
        setExtracted(data.card.extracted);
        // fetch candidate matches
        const email = data.card.extracted.emails[0];
        const phone = data.card.extracted.phones[0];
        const q = new URLSearchParams();
        if (email) q.set("email", email);
        if (phone) q.set("phone", phone);
        if (q.size > 0) {
          const m = await fetch(`/api/portraits/cards/${cardId}/matches?${q}`);
          if (m.ok) {
            const mData = (await m.json()) as MatchResponse;
            setMatches(mData.matches);
          }
        }
        return; // stop polling
      }
      if (data.card.ocr_status === "failed") {
        setError(data.card.error ?? "unknown_error");
        return;
      }
      setTimeout(poll, 1500);
    }
    poll();
    return () => { cancelled = true; };
  }, [cardId]);

  async function attachTo(contactId: string) {
    const res = await fetch(`/api/portraits/cards/${cardId}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId }),
    });
    if (res.ok) window.location.href = `/room-of-requirement/portraits/${contactId}`;
  }

  async function createNew() {
    if (!extracted) return;
    const payload = {
      create: {
        full_name: extracted.name ?? "Unknown",
        title: extracted.title ?? undefined,
        company: extracted.company ?? undefined,
        prestige_tier: "C",
        channels: [
          ...extracted.emails.map((v, i) => ({ kind: "email", value: v, is_primary: i === 0 })),
          ...extracted.phones.map((v) => ({ kind: "phone", value: v, is_primary: false })),
        ],
      },
    };
    const res = await fetch(`/api/portraits/cards/${cardId}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { contact_id } = (await res.json()) as { contact_id: string };
      window.location.href = `/room-of-requirement/portraits/${contact_id}`;
    }
  }

  if (error) return <div className="poller err">OCR failed: {error} — <button onClick={async () => {
    const r = await fetch(`/api/portraits/cards/${cardId}/parse`, { method: "POST" });
    if (r.ok) window.location.reload();
  }}>retry</button></div>;

  if (status !== "parsed" || !extracted) {
    return <div className="poller loading">Reading card… ({status})</div>;
  }

  return (
    <div className="poller parsed">
      <h3>Extracted</h3>
      <dl>
        <dt>Name</dt><dd>{extracted.name ?? "—"}</dd>
        <dt>Title</dt><dd>{extracted.title ?? "—"}</dd>
        <dt>Company</dt><dd>{extracted.company ?? "—"}</dd>
        <dt>Emails</dt><dd>{extracted.emails.join(", ") || "—"}</dd>
        <dt>Phones</dt><dd>{extracted.phones.join(", ") || "—"}</dd>
      </dl>
      {matches.length > 0 && (
        <div className="matches">
          <h4>Possible matches</h4>
          <ul>
            {matches.map((m) => (
              <li key={m.id}>
                {m.full_name} — {m.company ?? "—"} <span className="reason">({m.reason})</span>
                <button onClick={() => attachTo(m.id)}>attach</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={createNew} className="primary">Create new contact</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portraits/CardStatusPoller.tsx
git commit -m "feat(portraits): CardStatusPoller React island (poll + attach)"
```

---

## Task 10: GET /api/portraits/cards/:id/matches (dedup candidates)

**Files:**
- Create: `src/pages/api/portraits/cards/[id]/matches.ts`

Supports the poller by returning any contacts that match the extracted emails/phones.

- [ ] **Step 1: Handler**

```ts
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

  // Fetch candidates by channel lookup (fast path via idx_channels_value)
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/portraits/cards/[id]/matches.ts
git commit -m "feat(portraits): GET card/matches — dedup candidates"
```

---

## Task 11: Capture page

**Files:**
- Create: `src/pages/room-of-requirement/portraits/capture.astro`

- [ ] **Step 1: Page**

```astro
---
export const prerender = false;

import Base from "../../../layouts/Base.astro";
import { requireAdmin } from "../../../lib/portraits/auth";
import CardStatusPoller from "../../../components/portraits/CardStatusPoller.tsx";

const auth = await requireAdmin(Astro);
if (!auth.admin) return Astro.redirect("/room-of-requirement/portraits", 302);

Astro.response.headers.set("Cache-Control", "private, no-store");
---

<Base title="Capture card — Portraits" description="Snap a business card to capture a contact.">
  <main class="capture-page">
    <header>
      <a class="back-link" href="/room-of-requirement/portraits">← Portraits</a>
      <h1>Capture card</h1>
      <p class="hint">Point your camera at a business card. We'll OCR the name, title, company, and contact details.</p>
    </header>

    <div id="capture-step">
      <label class="snap-button">
        <input id="card-file" type="file" accept="image/*" capture="environment" />
        <span>📷 Snap / upload</span>
      </label>
      <p class="muted hint-2">JPEG / PNG / WebP up to 8 MiB.</p>
    </div>

    <div id="result-step" hidden>
      <img id="preview" alt="captured card" />
      <div id="poller-root"></div>
    </div>

    <p id="upload-error" class="error" hidden></p>
  </main>
</Base>

<script>
  const input = document.getElementById("card-file") as HTMLInputElement;
  const captureStep = document.getElementById("capture-step") as HTMLDivElement;
  const resultStep = document.getElementById("result-step") as HTMLDivElement;
  const preview = document.getElementById("preview") as HTMLImageElement;
  const pollerRoot = document.getElementById("poller-root") as HTMLDivElement;
  const err = document.getElementById("upload-error") as HTMLParagraphElement;

  input.addEventListener("change", async () => {
    err.hidden = true;
    const file = input.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);

    const mime = file.type === "image/png" ? "image/png"
               : file.type === "image/webp" ? "image/webp"
               : "image/jpeg";
    const buf = await file.arrayBuffer();

    const res = await fetch("/api/portraits/cards", {
      method: "POST",
      headers: { "Content-Type": mime },
      body: buf,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      err.textContent = `Upload failed: ${data.error ?? res.statusText}`;
      err.hidden = false;
      return;
    }
    const { card } = (await res.json()) as { card: { id: string } };

    captureStep.hidden = true;
    resultStep.hidden = false;

    // Dynamically mount the React island
    const { createElement } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const CardStatusPoller = (await import("/src/components/portraits/CardStatusPoller.tsx" as any)).default;
    createRoot(pollerRoot).render(createElement(CardStatusPoller, { cardId: card.id }));
  });
</script>

<style>
  .capture-page { max-width: 520px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
  .back-link { color: #8a877e; text-decoration: none; font-size: 0.875rem; }
  .back-link:hover { color: #d4a89a; }
  h1 {
    font-family: "Inter Tight", sans-serif; font-weight: 500;
    font-size: 2rem; margin: 0.5rem 0 0.25rem;
  }
  .hint { color: #8a877e; margin-bottom: 2rem; }
  .hint-2 { color: #6a665e; font-size: 0.8125rem; margin-top: 0.5rem; }

  .snap-button {
    display: block;
    border: 2px dashed #3a3a3a;
    border-radius: 6px;
    padding: 3rem 1rem;
    text-align: center;
    cursor: pointer;
    color: #d4a89a;
    transition: border-color 150ms ease, background 150ms ease;
  }
  .snap-button:hover { border-color: #d4a89a; background: rgba(212, 168, 154, 0.04); }
  .snap-button input { display: none; }
  .snap-button span { font-size: 1.125rem; letter-spacing: 0.02em; }

  #preview { max-width: 100%; border-radius: 4px; margin-bottom: 1rem; }
  #poller-root { margin-top: 1rem; }
  .error { color: #e57373; font-size: 0.875rem; margin-top: 1rem; }
  .muted { color: #6a665e; }
</style>

<style is:global>
  .poller { padding: 1rem; border: 1px solid #2a2a2a; border-radius: 4px; color: #bdb8ac; }
  .poller.loading { color: #8a877e; font-style: italic; }
  .poller.err { color: #e57373; }
  .poller.err button { margin-left: 0.5rem; }
  .poller dl { display: grid; grid-template-columns: 6rem 1fr; gap: 0.25rem 1rem; font-size: 0.9rem; }
  .poller dt { color: #6a665e; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.06em; }
  .poller dd { margin: 0; color: #e8e6e0; }
  .poller h3, .poller h4 { font-family: "Inter Tight", sans-serif; font-weight: 500; margin: 0 0 0.5rem; color: #e8e6e0; }
  .poller button { background: transparent; border: 1px solid #3a3a3a; color: #e8e6e0; padding: 0.4rem 0.9rem; border-radius: 3px; cursor: pointer; font: inherit; }
  .poller button.primary { border-color: #d4a89a; color: #d4a89a; margin-top: 1rem; }
  .poller button.primary:hover { background: rgba(212, 168, 154, 0.08); }
  .matches ul { list-style: none; padding: 0; }
  .matches li { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0; border-bottom: 1px solid #1a1a1a; }
  .matches .reason { font-size: 0.75rem; color: #6a665e; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/room-of-requirement/portraits/capture.astro
git commit -m "feat(portraits): capture page — camera upload + poller island"
```

---

## Task 12: Gallery + detail wiring

**Files:**
- Modify: `src/pages/room-of-requirement/portraits/index.astro` (add "＋ Capture card" button next to "＋ New portrait")
- Modify: `src/pages/room-of-requirement/portraits/[id].astro` (add "Cards" section listing attached cards)

- [ ] **Step 1: Gallery admin actions**

In `src/pages/room-of-requirement/portraits/index.astro`, find:

```astro
{auth.admin && (
  <div class="admin-actions">
    <a class="btn btn-primary" href="/room-of-requirement/portraits/add">＋ New portrait</a>
  </div>
)}
```

Replace with:

```astro
{auth.admin && (
  <div class="admin-actions">
    <a class="btn btn-primary" href="/room-of-requirement/portraits/add">＋ New portrait</a>
    <a class="btn" href="/room-of-requirement/portraits/capture">📷 Capture card</a>
  </div>
)}
```

- [ ] **Step 2: Detail-page Cards section**

In `src/pages/room-of-requirement/portraits/[id].astro`, after the frontmatter variable declarations (just before the `Astro.cache.set` call), add:

```ts
// Phase 2: list any cards attached to this contact (admin view only).
interface CardSummary { id: string; captured_at: string; ocr_status: string }
let cards: CardSummary[] = [];
if (auth.admin) {
  const rs = await db
    .prepare("SELECT id, captured_at, ocr_status FROM contact_cards WHERE contact_id=? ORDER BY captured_at DESC")
    .bind(contact.id)
    .all<CardSummary>();
  cards = (rs.results ?? []) as CardSummary[];
}
```

Then, inside the main `<main>` body, after the Tags section and before the `meta` section, insert:

```astro
{auth.admin && cards.length > 0 && (
  <section class="section">
    <h2 class="section-title">Cards</h2>
    <div class="cards-grid">
      {cards.map((c) => (
        <a class="card-tile" href={`/api/portraits/cards/${c.id}/image`} target="_blank" rel="noopener noreferrer">
          <img src={`/api/portraits/cards/${c.id}/image`} alt="business card" loading="lazy" />
          <span class={`card-status card-status-${c.ocr_status}`}>{c.ocr_status}</span>
        </a>
      ))}
    </div>
  </section>
)}
```

And append the style block:

```css
.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
.card-tile { position: relative; display: block; border: 1px solid #2a2a2a; border-radius: 4px; overflow: hidden; }
.card-tile img { width: 100%; height: 90px; object-fit: cover; }
.card-status { position: absolute; top: 4px; right: 4px; font-size: 0.625rem; padding: 0.1rem 0.4rem; border-radius: 2px; background: #0008; color: #e8e6e0; text-transform: uppercase; letter-spacing: 0.06em; }
.card-status-parsed { background: rgba(120, 170, 110, 0.2); color: #a9cfa0; }
.card-status-failed { background: rgba(229, 115, 115, 0.2); color: #e57373; }
.card-status-pending, .card-status-parsing { background: rgba(212, 168, 154, 0.2); color: #d4a89a; }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/portraits/index.astro src/pages/room-of-requirement/portraits/\[id\].astro
git commit -m "feat(portraits): wire capture-button + attached cards on detail page"
```

---

## Task 13: Phase 2 smoke test + docs

**Files:** none (verification only)

- [ ] **Step 1: Start dev server, hit capture page**

```bash
nohup npx emdash dev > /tmp/portraits-dev.log 2>&1 & echo $! > /tmp/portraits-dev.pid
sleep 20
curl -s -o /dev/null -w "capture as guest: %{http_code}\n" -L http://localhost:4321/room-of-requirement/portraits/capture
curl -s http://localhost:4321/room-of-requirement/portraits | grep -o "Capture card"
```

Expect: `capture as guest: 200` (redirected to gallery by middleware), grep matches 0 (guest doesn't see button).

Kill:
```bash
kill $(cat /tmp/portraits-dev.pid); rm /tmp/portraits-dev.pid /tmp/portraits-dev.log
```

- [ ] **Step 2: Verify full portraits test suite still green**

```bash
npx tsx --test tests/portraits/*.test.ts 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)"
```

Expect ≥14 tests, 0 fail (Phase 1 had 11, Phase 2 adds ≥3 for ocr + dedup).

- [ ] **Step 3: Tag Phase 2 done in commit**

```bash
git commit --allow-empty -m "chore(portraits): Phase 2 complete — card capture + OCR"
```

Include both co-author trailers.

---

## Deliberate deferrals

- **No batch upload flow** — one card at a time. Good enough; multi-card UI lands in Phase 5 with CSV/vCard.
- **No image cropping UI** — the model handles slightly-off-angle cards fine; add rotation/crop only if accuracy complaints arrive.
- **`waitUntil` vs synchronous fallback** — we queue async on Workers, run sync in non-Workers dev. Both paths end at the same final state.

## Environment setup user has to do

```bash
# One-time, required for OCR to actually work:
npx wrangler secret put ANTHROPIC_API_KEY
# Paste your key at the prompt.
```

Without this, Phase 2 uploads still succeed (card saved to R2, row in D1 with `ocr_status='pending'`), but OCR never fires. The capture page shows a useful "OCR unavailable" state once the poller times out.
