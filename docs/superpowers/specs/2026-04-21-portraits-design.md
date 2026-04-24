# Portraits — Private Contact Gallery

## Problem

Loc has a growing, scattered network: contacts live across iOS Contacts, Google Contacts, Facebook, LinkedIn, and physical business cards that accumulate in drawers. Retrieval during the moments that matter (mid-dinner, at a conference, right before a call) is slow and error-prone. There is no single place to see "who do I know at tier X, working on Y, introduced by Z."

The list will grow exponentially as Loc continues operating across VNG alumni networks, Papaya / Oasis, and the 2026 outreach sprint. A v1 must be ambitious enough that it doesn't need a v2 rewrite within 12 months.

Existing Pensieve infra already gives us SSR pages, D1, R2, KV, Resend, and an EmDash admin session. We need a private gallery that (a) gates on that admin session, (b) shows a curated demo list to guests so the page reads as "a serious operator's rolodex" rather than a blank door, and (c) ingests cards through every reasonable path.

## Solution

Build **Portraits** at `/room-of-requirement/portraits` — a full contacts subsystem with five prestige tiers, seven D1 tables, Claude-vision OCR for business cards, Resend-powered outreach, Google Contacts OAuth2 sync, an interaction timeline, a relationship graph, and reminders — gated on the existing EmDash admin session.

HP metaphor: portraits in the Headmaster's office. S-tier (Founder) hangs in the main hall; D-tier (Visitor) fills the corridor. You consult them like Dumbledore consults his predecessors.

## Auth model

No new auth infra. We proxy the existing EmDash admin session from every Portraits request.

```ts
// src/lib/portraits/auth.ts
export async function requireAdmin(Astro: AstroGlobal) {
  const cookie = Astro.request.headers.get("cookie") ?? "";
  const me = await fetch(new URL("/_emdash/api/auth/me", Astro.url), {
    headers: { cookie },
  });
  if (!me.ok) return { admin: false, user: null };
  const body = await me.json() as { user?: { role: number; email: string } };
  return {
    admin: (body.user?.role ?? 0) >= 50, // 50 = Admin; Editors (40) and below are treated as guests — contacts are for Loc only
    user: body.user ?? null,
  };
}
```

- Guests (no session, role < 40) see the public demo gallery with a "🔒 private collection — showing demo portraits" ribbon.
- Admin (role ≥ 50) sees real contacts and admin controls.
- All mutation endpoints re-check via the same helper; no endpoint trusts the page layer.
- Session cookie is never read directly — if EmDash adds passkeys, rotates cookie names, or switches to Cloudflare Access, this keeps working.

## Information architecture

```
/room-of-requirement/portraits           Gallery (admin: real / guest: demo)
/room-of-requirement/portraits/[id]      Detail view (slide-over on desktop, full page on mobile)
/room-of-requirement/portraits/add       New contact form (admin-only)
/room-of-requirement/portraits/import    vCard / CSV bulk import (admin-only)
/room-of-requirement/portraits/capture   Business-card camera capture (admin-only, mobile-optimized)
/room-of-requirement/portraits/sync      Integrations dashboard — Google/iOS/Facebook/LinkedIn status (admin-only)
/room-of-requirement/portraits/graph     Relationship graph full-screen view (admin-only)
```

API surface (all under `/api/portraits/`, all admin-gated except `ingest` which uses a bearer token):

```
GET    /api/portraits                  list + search + filter
POST   /api/portraits                  create
GET    /api/portraits/:id              read (hydrated with channels, notes, cards, interactions, edges)
PATCH  /api/portraits/:id              update
DELETE /api/portraits/:id              soft-delete

POST   /api/portraits/:id/channels     add channel
PATCH  /api/portraits/:id/channels/:cid
DELETE /api/portraits/:id/channels/:cid

POST   /api/portraits/:id/notes        add note
POST   /api/portraits/:id/interactions log a call / meeting / email
POST   /api/portraits/:id/edges        link two contacts (intro'd-by, works-with, mentor-of)
DELETE /api/portraits/:id/edges/:eid

POST   /api/portraits/cards            upload card image → R2 → queue OCR → returns card_id
POST   /api/portraits/cards/:id/parse  trigger OCR (idempotent)
POST   /api/portraits/cards/:id/attach attach to an existing contact OR create one

POST   /api/portraits/import/vcard     parse .vcf, return preview
POST   /api/portraits/import/vcard/commit  confirm import after preview

POST   /api/portraits/outreach/send    send email via Resend, log as interaction

GET    /api/portraits/integrations/google/start    OAuth2 begin
GET    /api/portraits/integrations/google/callback OAuth2 callback
POST   /api/portraits/integrations/google/sync     manual full sync
GET    /api/portraits/integrations/status          all integrations health

POST   /api/portraits/ingest           external ingestion (openclaw, iOS Shortcuts) — bearer-token auth
```

## Data model (D1, 7 tables)

```sql
-- 1. Core contact
CREATE TABLE contacts (
  id             TEXT PRIMARY KEY,  -- ULID
  full_name      TEXT NOT NULL,
  display_name   TEXT,              -- short form for cards
  title          TEXT,
  company        TEXT,
  company_domain TEXT,              -- enables favicon + dedup
  photo_key      TEXT,              -- R2 key
  prestige_tier  TEXT NOT NULL CHECK (prestige_tier IN ('S','A','B','C','D')),
  tier_score     INTEGER DEFAULT 50 CHECK (tier_score BETWEEN 0 AND 100),
  location       TEXT,
  bio            TEXT,              -- free-form 1-2 sentences
  source         TEXT NOT NULL,     -- manual|ios|google|facebook|linkedin|card|openclaw|shortcut
  external_ids   TEXT,              -- JSON: {google_resource_name, linkedin_url, facebook_id}
  tags           TEXT,              -- JSON array
  birthday       TEXT,              -- YYYY-MM-DD or --MM-DD if year unknown
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  deleted_at     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_contacts_tier ON contacts(prestige_tier, tier_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_company ON contacts(company) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_placeholder ON contacts(is_placeholder);

-- 2. Channels (email, phone, messenger IDs, social)
CREATE TABLE contact_channels (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,  -- email|phone|telegram|signal|whatsapp|linkedin|twitter|x|facebook|wechat|zalo|url
  value       TEXT NOT NULL,
  label       TEXT,           -- work|personal|main
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_channels_contact ON contact_channels(contact_id);
CREATE INDEX idx_channels_value ON contact_channels(value);  -- for dedup lookups

-- 3. Private notes (markdown)
CREATE TABLE contact_notes (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 4. Business card captures
CREATE TABLE contact_cards (
  id            TEXT PRIMARY KEY,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  r2_key        TEXT NOT NULL,
  captured_at   TEXT NOT NULL,
  ocr_status    TEXT NOT NULL,  -- pending|parsing|parsed|failed
  ocr_provider  TEXT,           -- claude-vision|workers-ai|openclaw
  raw_ocr_json  TEXT,           -- full response for debugging
  extracted     TEXT,           -- JSON: { name, title, company, emails[], phones[], ... }
  error         TEXT
);
CREATE INDEX idx_cards_pending ON contact_cards(ocr_status) WHERE ocr_status IN ('pending','parsing');

-- 5. Interaction timeline
CREATE TABLE contact_interactions (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,  -- met|call|email_sent|email_received|note|deal|intro
  body         TEXT,
  happened_at  TEXT NOT NULL,
  metadata     TEXT,           -- JSON: { resend_message_id, location, deal_stage, ... }
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_interactions_contact_time ON contact_interactions(contact_id, happened_at DESC);

-- 6. Relationship graph edges
CREATE TABLE contact_edges (
  id            TEXT PRIMARY KEY,
  src_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  dst_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,  -- introduced_by|works_with|mentor_of|invested_in|spouse|same_company
  note          TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE(src_id, dst_id, kind)
);
CREATE INDEX idx_edges_src ON contact_edges(src_id);
CREATE INDEX idx_edges_dst ON contact_edges(dst_id);

-- 7. Reminders
CREATE TABLE contact_reminders (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,  -- birthday|follow_up|anniversary|custom
  due_at       TEXT NOT NULL,  -- next occurrence (auto-recomputed for birthday)
  recurring    TEXT,           -- yearly|quarterly|monthly|null
  body         TEXT,
  dismissed_at TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_reminders_due ON contact_reminders(due_at) WHERE dismissed_at IS NULL;
```

Integration credentials live in a separate KV-backed table (or directly in KV; see Integrations).

## Prestige tier visual treatment

Tier drives the physical hierarchy of the gallery, not just a badge.

| Tier | Name      | Meaning                                              | Card treatment                                                                  |
|------|-----------|------------------------------------------------------|---------------------------------------------------------------------------------|
| S    | Founder   | Billionaires, unicorn founders, state-level figures | Large (320px), gold-leaf ornate SVG frame, candle-glow pulse, hero row at top |
| A    | Headmaster| C-suite public/unicorn, top-tier VCs                 | Medium-large (240px), silver frame, subtle candle                               |
| B    | Professor | Directors, partners, notable operators               | Medium (180px), bronze frame                                                     |
| C    | Scholar   | Senior ICs, promising builders                       | Small (140px), thin etched frame                                                 |
| D    | Visitor   | General contacts, met-once folks                     | Row form (compact table, no frame)                                               |

Within a tier, sort by `tier_score` desc, then `updated_at` desc.

A small "bump tier" menu on each card lets Loc promote/demote from the gallery without opening the detail view. Score is edited in the detail panel.

## Gallery layout

```
/room-of-requirement/portraits

┌──────────────────────────────────────────────────────────────────────────────┐
│  Portraits · 147 contacts · 3 reminders due this week          [＋ new] [↧] │
│  🔍 search name · company · tag                    tier: [all S A B C D]     │
│  source: [all · ios · google · card]    tag: [founder · investor · friend]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  MAIN HALL — Founders (4)                                                    │
│  [   Jensen   ] [   Satya   ] [  Sundar  ] [  Vượng  ]                        │
│                                                                              │
│  HEADMASTERS — (8)                                                           │
│  [ Lisa Su ] [ Dario ] [ Collison ] [ Bình ] [ ... ]                         │
│                                                                              │
│  PROFESSORS — (22)                                                           │
│  [ Karpathy ] [ Lattner ] [ Rauch ] [ Hà Đông ] [ ... ]                       │
│                                                                              │
│  SCHOLARS — (41)  [expand]                                                   │
│  [ ... ]                                                                     │
│                                                                              │
│  CORRIDOR — Visitors (72)  [expand]                                          │
│  ┌─ Name ─────────── Company ─── Last seen ─ Tier ─ ⋯ ─┐                     │
│  │                                                    │                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Guest view: same layout, `is_placeholder=1` filter, ribbon across the hero `🔒 private collection — showing demo portraits`. No admin controls render.

Each card clicks into a detail slide-over (right 50% on desktop, full page on mobile) with tabs:

- **Overview** — all channels (click to copy / launch tel: / open URL), tags, bio
- **Timeline** — reverse-chronological interactions
- **Notes** — markdown notes, add new
- **Relationships** — inbound and outbound edges with 1-hop graph preview (ReactFlow)
- **Cards** — all captured business card images
- **Meta** — source, external IDs, created/updated

## Ingestion paths

### 1. Manual add
Form at `/portraits/add`. Required: full_name, prestige_tier. Optional: everything else. Add channels in-form with the "+ add email / phone / social" pattern.

### 2. Business card capture — Claude vision OCR
`/portraits/capture` on mobile opens `<input type="file" accept="image/*" capture="environment">`. Flow:

1. Upload image → `POST /api/portraits/cards` → R2 at `portraits/cards/{ulid}.jpg`, creates row with `ocr_status='pending'`.
2. Worker immediately triggers OCR via `waitUntil`:
   - Fetches image bytes from R2.
   - Calls Anthropic API with `claude-sonnet-4-6`, vision input, prompt: "Extract contact details from this business card. Return strict JSON with fields: name, title, company, emails (array), phones (array, E.164), addresses (array), websites (array), socials (object keyed by platform). Use null for unknown fields."
   - Parses response into `extracted` JSON, sets `ocr_status='parsed'`.
3. UI polls `GET /api/portraits/cards/:id` until parsed, then shows:
   - "Matches found: Andrej Karpathy · OpenAI" (dedup via email/phone/name+company) — "attach" or "create new"
   - Or: pre-filled "new contact" form with the extracted data, user reviews & saves.

Claude key lives in `ANTHROPIC_API_KEY` wrangler secret. Cost: ~$0.003 per card at current Sonnet vision pricing — negligible.

### 3. vCard / CSV bulk import
`/portraits/import` accepts `.vcf` (iOS / iCloud / Android export) and `.csv` (Google Contacts, LinkedIn export).

- Parse in the Worker. Preview first 20 rows with proposed tier (default D unless email domain matches a tier-elevation rule, see AI tier-suggestion below).
- Admin can batch-edit tier / tags in the preview, then commit.
- Dedup on primary email or phone before insert.

### 4. Google Contacts OAuth2 sync
Standard Google OAuth2 flow, People API v1 read-only scope (`https://www.googleapis.com/auth/contacts.readonly`).

- Credentials: `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` in wrangler secrets.
- Refresh token stored in KV at `portraits:integration:google:refresh`.
- Sync task walks all connections, inserts or updates rows with `source='google'` and `external_ids.google_resource_name` as the merge key.
- Manual "sync now" button in `/portraits/sync`. Cron trigger runs every 6 hours (`0 */6 * * *` via wrangler `[triggers]`).
- Downloaded avatars streamed to R2.

### 5. iOS sync (two parallel paths)
- **iCloud CardDAV export** — instruct user to export all contacts as `.vcf` from iCloud, upload via path 3. Simpler than running a CardDAV client in a Worker.
- **iOS Shortcuts push** — provide a downloadable `.shortcut` file that picks a contact, posts to `/api/portraits/ingest` with a bearer token. Loc can run it from share sheet on a contact card.

### 6. Facebook
Meta retired friend-list API for 3rd parties. Users must use "Download Your Information" → CSV → path 3. UI in `/portraits/sync` explains and links to `https://www.facebook.com/dyi/`.

### 7. LinkedIn
LinkedIn general contacts API is gated behind a paid partnership. Users export "My Network > Connections > Export" → CSV → path 3. Same UX pattern as Facebook.

### 8. openclaw / external agent
`POST /api/portraits/ingest` with bearer token from `PORTRAITS_INGEST_TOKEN` secret. Accepts:

```json
{
  "source": "openclaw",
  "contact": {
    "full_name": "…", "title": "…", "company": "…",
    "channels": [{ "kind": "email", "value": "…" }],
    "tags": ["…"], "bio": "…"
  },
  "card_r2_key": "portraits/cards/01H…jpg"  // optional — link to captured card
}
```

Idempotent via `(source, external_ids.openclaw_id)` pair.

## Outreach (email send via Resend)

Detail slide-over has a "📧 compose" button on any email channel.

- Modal with subject + body (markdown).
- Send via Resend (plugin already installed).
- On success, insert a `contact_interactions` row with `kind='email_sent'`, `metadata.resend_message_id`.

## Relationship graph

Detail view has a "Relationships" tab with a compact 1-hop graph using ReactFlow (light dependency, already common in the Astro+React template):

```
           ┌──────────┐
           │ Karpathy │ (this contact)
           └────┬─────┘
      works_with│  │introduced_by
      ┌─────────┘  └─────────┐
┌─────▼─────┐          ┌─────▼─────┐
│  Altman   │          │  Rauch    │
└───────────┘          └───────────┘
```

Full-screen graph at `/portraits/graph` — force-directed layout showing all admin-owned contacts with prestige tier colouring nodes. Click a node → jump to detail.

Adding edges: from detail view, "+ link" → search other contact → pick edge kind.

## Reminders

Cron trigger runs daily at 06:00 Asia/Ho_Chi_Minh (`0 23 * * *` UTC — Wrangler `[triggers]` supports multiple crons; Portraits adds two: one for reminders, one for Google sync):

- Recompute birthday reminders for the next 90 days (insert rows into `contact_reminders` with `kind='birthday'` if not already present).
- Scan contacts with S/A tier where `last_interaction_at < NOW - 6 months` — insert `follow_up` reminder.

Gallery shows a `⏰ 3 reminders due this week` pill in the header, click → slide-over list, each "remind me in 1w / done / snooze".

Optional email digest: daily email at 07:00 to Loc with reminders due in the next 7 days — via Resend, gated on a boolean setting in KV.

## AI tier-suggestion (bonus)

When a new contact is created (via any path), run a Claude-powered enrichment pass:

- Input: full_name, title, company, company_domain, bio.
- Prompt: "Given this person's public profile, suggest a prestige tier: S (billionaire/unicorn founder/head of state), A (C-suite public/unicorn/top VC), B (director/partner/notable operator), C (senior IC/builder), D (general). Respond with just one letter plus a 1-sentence reason."
- Prefill `prestige_tier` in the create form; Loc can override.
- Runs via `waitUntil` so it never blocks UI.
- Skippable via `?no_ai=1` query param.

## Placeholder / demo data (for guests)

12 entries seeded via migration, `is_placeholder=1`:

| Tier | Name                 | Company        | Why (for vibe)                                 |
|------|----------------------|----------------|------------------------------------------------|
| S    | Jensen Huang         | NVIDIA         | Iconic CEO, semiconductor era-defining figure |
| S    | Satya Nadella        | Microsoft      | Enterprise cloud dominance                     |
| S    | Sundar Pichai        | Alphabet       | Search + Android + now Gemini                  |
| S    | Phạm Nhật Vượng      | Vingroup       | Largest VN net-worth, VinFast                  |
| A    | Lisa Su              | AMD            | Turnaround architect                           |
| A    | Dario Amodei         | Anthropic      | Frontier AI labs                               |
| A    | Patrick Collison     | Stripe         | Payments + developer tools                     |
| A    | Trương Gia Bình      | FPT            | VN tech elder statesman                        |
| B    | Andrej Karpathy      | Eureka Labs    | AI educator + ex-Tesla / OpenAI                |
| B    | Chris Lattner        | Modular        | LLVM / Swift / Mojo                            |
| B    | Guillermo Rauch      | Vercel         | Frontend infra                                 |
| B    | Nguyễn Hà Đông       | dotGEARS       | Flappy Bird, VN indie legend                   |

Each has:
- `is_placeholder=1`
- Email `firstname@demo.portrait` (non-routable synthetic domain)
- Phone `+00 000 000 0000`
- Bio: one-sentence context based on public biography
- Tags like `founder`, `ai`, `semi`, `vn-tech`
- No notes, no cards, no reminders
- No relationships among each other (avoid implying endorsement)
- A small `★ demo` ribbon on the card

Admin default filter hides placeholders; there's a toggle to show them (for screenshots / demos).

## Security notes

- All mutation endpoints re-check `requireAdmin`. The gallery page being admin-only is not a security boundary by itself.
- The same `PORTRAITS_INGEST_TOKEN` secret authenticates both openclaw and the iOS Shortcut. Verified constant-time to avoid length-leak; rate-limited via Cloudflare. Rotate by setting a new wrangler secret; both integrations re-issue.
- R2 card images are served only via a signed-URL helper `GET /api/portraits/cards/:id/image` that re-checks admin. No public R2 URLs.
- XSS: notes, bios, and OCR-extracted fields pass through DOMPurify (client-side) and a server-side markdown renderer with safelist (use `marked` + strict config; no raw HTML).
- OAuth state param stored in KV with 10-min TTL to block CSRF on the Google callback.
- Placeholder contacts never get mixed into admin queries unless `include_placeholders=1` is passed; that flag is ignored on guest view.
- Guest responses never include `is_placeholder=0` data — enforced at the query layer, not in the template.

## R2 layout

```
portraits/cards/{ulid}.jpg      -- original uploaded business-card images
portraits/photos/{ulid}.jpg     -- profile portraits (manual + Google avatar sync)
```

All reads go through the signed `/api/portraits/cards/:id/image` endpoint (for cards) or `/api/portraits/photos/:id` (for portraits). No public R2 routes.

## Caching

- Admin view: `Cache-Control: private, no-store` — never cached.
- Guest view: `Astro.cache.set(cacheHint)` with 1-hour TTL keyed on `is_placeholder=1, deleted_at IS NULL` query.
- Card images from R2: 1-year immutable cache after signed-URL check (keys are ULIDs so cache-safe).

## Implementation phases

Full scope splits into 5 phases. Each is shippable on its own and gated by the previous.

### Phase 1 — Foundation (MVP-visible gallery)
- Migration for all 7 tables.
- `requireAdmin` helper.
- Seed placeholder contacts.
- Gallery page with tier layout (S through D), guest + admin modes.
- Detail slide-over (Overview tab only).
- Manual add form (`/portraits/add`).
- `GET /api/portraits`, `POST /api/portraits`, `GET /api/portraits/:id`.

### Phase 2 — Card capture + OCR
- R2 upload endpoint.
- Claude vision OCR via `waitUntil`.
- Capture page (mobile camera flow).
- Card → contact dedup + attach UX.

### Phase 3 — Interactions, notes, reminders
- Timeline tab.
- Notes tab (markdown).
- Reminder model + daily cron.
- "reminders due this week" UI pill.

### Phase 4 — Relationship graph + outreach
- Edges model + API.
- Relationships tab (1-hop ReactFlow).
- Full-screen graph at `/portraits/graph`.
- Resend compose modal + interaction log.

### Phase 5 — Integrations
- vCard / CSV import with preview.
- Google Contacts OAuth2 + People API sync + 6h cron.
- iOS Shortcut downloadable.
- Facebook / LinkedIn instructions panel.
- `/api/portraits/ingest` bearer-token endpoint for openclaw.
- AI tier-suggestion on create.

## Files to create

```
src/pages/room-of-requirement/portraits/index.astro
src/pages/room-of-requirement/portraits/[id].astro
src/pages/room-of-requirement/portraits/add.astro
src/pages/room-of-requirement/portraits/import.astro
src/pages/room-of-requirement/portraits/capture.astro
src/pages/room-of-requirement/portraits/sync.astro
src/pages/room-of-requirement/portraits/graph.astro

src/pages/api/portraits/index.ts
src/pages/api/portraits/[id].ts
src/pages/api/portraits/[id]/channels/index.ts
src/pages/api/portraits/[id]/channels/[cid].ts
src/pages/api/portraits/[id]/notes.ts
src/pages/api/portraits/[id]/interactions.ts
src/pages/api/portraits/[id]/edges/index.ts
src/pages/api/portraits/[id]/edges/[eid].ts
src/pages/api/portraits/cards/index.ts
src/pages/api/portraits/cards/[id].ts
src/pages/api/portraits/cards/[id]/image.ts
src/pages/api/portraits/cards/[id]/parse.ts
src/pages/api/portraits/cards/[id]/attach.ts
src/pages/api/portraits/import/vcard.ts
src/pages/api/portraits/import/vcard/commit.ts
src/pages/api/portraits/outreach/send.ts
src/pages/api/portraits/integrations/google/start.ts
src/pages/api/portraits/integrations/google/callback.ts
src/pages/api/portraits/integrations/google/sync.ts
src/pages/api/portraits/integrations/status.ts
src/pages/api/portraits/ingest.ts

src/lib/portraits/auth.ts
src/lib/portraits/db.ts           -- query helpers
src/lib/portraits/ocr.ts          -- Claude vision client
src/lib/portraits/vcard.ts        -- parser
src/lib/portraits/google.ts       -- People API client
src/lib/portraits/resend.ts       -- compose + send
src/lib/portraits/tier.ts         -- tier rules + AI suggestion
src/lib/portraits/dedup.ts        -- matching by email/phone/name+company
src/lib/portraits/reminders.ts    -- birthday + follow-up computation

src/components/portraits/Gallery.astro
src/components/portraits/TierSection.astro
src/components/portraits/PortraitCard.astro
src/components/portraits/CorridorTable.astro
src/components/portraits/DetailSlideOver.tsx  -- React (slide animation)
src/components/portraits/Timeline.tsx
src/components/portraits/NotesTab.tsx
src/components/portraits/RelationshipsTab.tsx
src/components/portraits/GraphView.tsx        -- ReactFlow
src/components/portraits/ComposeModal.tsx
src/components/portraits/CaptureFlow.tsx
src/components/portraits/frames/              -- SVG frames S/A/B/C

migrations/2026-04-21-portraits.sql
seed/portraits-placeholder.sql
```

`src/data/site-routes.json` updated with the new `/room-of-requirement/portraits` index so sitemap / llms.txt / ai-plugin.json reflect it (the page itself is admin-gated; the entry can be present as a pointer).

## Dependencies added

- `@anthropic-ai/sdk` — Claude vision OCR + tier suggestion.
- `reactflow` — relationship graph.
- `marked` + `isomorphic-dompurify` — safe markdown rendering for notes and bios.

Google People API is called directly with `fetch` (hand-rolled, no `googleapis` SDK — smaller bundle, Cloudflare-friendly).

No new Cloudflare services — D1, R2, KV, Workers AI all existing. Resend plugin already present.

## Secrets (wrangler)

```
ANTHROPIC_API_KEY            -- Claude vision OCR + tier suggestion
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
PORTRAITS_INGEST_TOKEN       -- bearer for /api/portraits/ingest
```

## Out of scope (deferred past Phase 5)

These are genuinely out — not quiet cuts, but future epics once Phase 1-5 ships:

- Relationship-graph-based outreach ("who do I know at Anthropic?") with multi-hop path suggestions.
- iOS native app / CardDAV client in-Worker.
- Encrypted-at-rest notes (client-side encryption via WebCrypto).
- Shared collaborator access (Loc gets a co-owner; multi-user permissioning).
- Automated enrichment from Crunchbase / Clearbit / LinkedIn scraping.
- Deal-pipeline tracking (contacts → companies → deals).
- Event check-in ("scan everyone at this dinner in batch").

## Success criteria

Phase 1 ships when:
- Guest gets a demo gallery that reads as "a serious operator's rolodex" — the 12 placeholder entries with tier hierarchy.
- Admin can add a contact manually, see it slot into the right tier, click into its detail, copy an email with one tap.
- Both flows work from phone and desktop.

Phases 2-5 each ship when their loop closes end-to-end without manual DB ops:
- Phase 2: phone camera → card visible in gallery within 30 seconds.
- Phase 3: Loc's real birthday entered, banner shows next year's reminder.
- Phase 4: 20 real contacts entered, 10 edges added, graph view renders < 2s.
- Phase 5: 500+ Google contacts imported, no dupes, sync runs on cron.
