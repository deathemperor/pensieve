# Portraits — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a shippable, admin-gated contact gallery at `/room-of-requirement/portraits` with five prestige tiers, twelve Silicon/NASDAQ placeholder portraits for guests, manual contact creation, and a detail view. This is Phase 1 of five — card capture/OCR, reminders, graph, outreach, and Google/iOS integrations are separate plans.

**Architecture:**
Admin authentication proxies the existing EmDash session via a same-origin fetch to `/_emdash/api/auth/me`. Data lives in seven D1 tables (only `contacts` and `contact_channels` are exercised in Phase 1; all seven are created up front so later phases don't touch the migration). Gallery is a single Astro SSR page with guest/admin branching at render time. Tier-based visual hierarchy is driven by Astro components (`PortraitCard`, `TierSection`, `CorridorTable`) with tier-specific SVG frames.

**Tech Stack:** Astro 6 SSR + React 19 islands, Cloudflare Workers, D1 (SQLite), R2, KV, `node:test` + `tsx` for unit tests, `wrangler d1 execute` for migrations.

**Spec:** `docs/superpowers/specs/2026-04-21-portraits-design.md`

---

## File Structure (Phase 1)

Created in this plan:

```
scripts/portraits-001-schema.sql                 -- 7-table migration
scripts/portraits-002-placeholders.sql           -- 12 placeholder contacts + channels

src/lib/portraits/auth.ts                        -- requireAdmin helper (proxies /_emdash/api/auth/me)
src/lib/portraits/db.ts                          -- listContacts, getContact, createContact
src/lib/portraits/types.ts                       -- Contact, Channel, TierCode, ContactWithChannels

src/pages/api/portraits/index.ts                 -- GET list, POST create
src/pages/api/portraits/[id].ts                  -- GET single

src/pages/room-of-requirement/portraits/index.astro       -- gallery page
src/pages/room-of-requirement/portraits/add.astro         -- manual add form
src/pages/room-of-requirement/portraits/[id].astro        -- detail page (Overview tab)

src/components/portraits/frames/FrameGold.astro       -- S tier
src/components/portraits/frames/FrameSilver.astro     -- A tier
src/components/portraits/frames/FrameBronze.astro     -- B tier
src/components/portraits/frames/FrameEtched.astro     -- C tier
src/components/portraits/PortraitCard.astro          -- single card
src/components/portraits/TierSection.astro           -- S/A/B/C section
src/components/portraits/CorridorTable.astro         -- D tier compact rows
src/components/portraits/GuestBanner.astro           -- "private collection — demo" ribbon

tests/portraits/auth.test.ts
tests/portraits/db.test.ts
tests/portraits/api.test.ts
tests/portraits/schema.test.ts
```

Modified:

```
src/data/site-routes.json                       -- add /room-of-requirement/portraits entry
```

Each file has one responsibility. `auth.ts` does only auth. `db.ts` does only queries (no business rules). API files do only HTTP + validation + call into `db.ts`. Components are presentation-only; no data fetching inside.

---

## Task 1: Write the D1 schema migration

**Files:**
- Create: `scripts/portraits-001-schema.sql`

- [ ] **Step 1: Write the schema SQL**

Create `scripts/portraits-001-schema.sql`:

```sql
-- Portraits Phase 1 schema. Creates all 7 tables.
-- Only contacts + contact_channels are used in Phase 1; others are
-- reserved for Phase 2-5 so later migrations don't grow the footprint.

CREATE TABLE IF NOT EXISTS contacts (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  display_name   TEXT,
  title          TEXT,
  company        TEXT,
  company_domain TEXT,
  photo_key      TEXT,
  prestige_tier  TEXT NOT NULL CHECK (prestige_tier IN ('S','A','B','C','D')),
  tier_score     INTEGER NOT NULL DEFAULT 50 CHECK (tier_score BETWEEN 0 AND 100),
  location       TEXT,
  bio            TEXT,
  source         TEXT NOT NULL,
  external_ids   TEXT,
  tags           TEXT,
  birthday       TEXT,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  deleted_at     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_tier ON contacts(prestige_tier, tier_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_placeholder ON contacts(is_placeholder);

CREATE TABLE IF NOT EXISTS contact_channels (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  value       TEXT NOT NULL,
  label       TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channels_contact ON contact_channels(contact_id);
CREATE INDEX IF NOT EXISTS idx_channels_value ON contact_channels(value);

CREATE TABLE IF NOT EXISTS contact_notes (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_cards (
  id            TEXT PRIMARY KEY,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  r2_key        TEXT NOT NULL,
  captured_at   TEXT NOT NULL,
  ocr_status    TEXT NOT NULL,
  ocr_provider  TEXT,
  raw_ocr_json  TEXT,
  extracted     TEXT,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_pending ON contact_cards(ocr_status) WHERE ocr_status IN ('pending','parsing');

CREATE TABLE IF NOT EXISTS contact_interactions (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  body         TEXT,
  happened_at  TEXT NOT NULL,
  metadata     TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_time ON contact_interactions(contact_id, happened_at DESC);

CREATE TABLE IF NOT EXISTS contact_edges (
  id            TEXT PRIMARY KEY,
  src_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  dst_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE(src_id, dst_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_edges_src ON contact_edges(src_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON contact_edges(dst_id);

CREATE TABLE IF NOT EXISTS contact_reminders (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  due_at       TEXT NOT NULL,
  recurring    TEXT,
  body         TEXT,
  dismissed_at TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON contact_reminders(due_at) WHERE dismissed_at IS NULL;
```

- [ ] **Step 2: Apply migration to remote D1**

```bash
npx wrangler d1 execute pensieve-db --remote --file=scripts/portraits-001-schema.sql
```

Expected output: a JSON array with `"success": true` and no errors.

- [ ] **Step 3: Verify tables exist**

```bash
npx wrangler d1 execute pensieve-db --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'contact%' ORDER BY name"
```

Expected: names array contains `contact_cards`, `contact_channels`, `contact_edges`, `contact_interactions`, `contact_notes`, `contact_reminders`, `contacts`.

- [ ] **Step 4: Commit**

```bash
git add scripts/portraits-001-schema.sql
git commit -m "feat(portraits): add D1 schema migration (7 tables)"
```

---

## Task 2: Add schema smoke test

**Files:**
- Create: `tests/portraits/schema.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/portraits/schema.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("portraits tables exist in remote D1", () => {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "pensieve-db",
      "--remote",
      "--json",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contacts','contact_channels','contact_notes','contact_cards','contact_interactions','contact_edges','contact_reminders') ORDER BY name",
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as Array<{ results: Array<{ name: string }> }>;
  const names = parsed[0].results.map((r) => r.name);
  assert.deepEqual(names, [
    "contact_cards",
    "contact_channels",
    "contact_edges",
    "contact_interactions",
    "contact_notes",
    "contact_reminders",
    "contacts",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
npm test -- tests/portraits/schema.test.ts
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add tests/portraits/schema.test.ts
git commit -m "test(portraits): verify 7 tables exist in remote D1"
```

---

## Task 3: Seed placeholder portraits

**Files:**
- Create: `scripts/portraits-002-placeholders.sql`

- [ ] **Step 1: Write the seed SQL**

Create `scripts/portraits-002-placeholders.sql`. Uses deterministic IDs (`pp_01` through `pp_12`) so re-running is idempotent. `@demo.portrait` is a non-routable synthetic domain:

```sql
-- Portraits Phase 1 placeholder data.
-- 12 contacts with is_placeholder=1. Guests see exactly these; admin filters them out by default.

INSERT OR REPLACE INTO contacts
  (id, full_name, display_name, title, company, company_domain, prestige_tier, tier_score, location, bio, source, tags, is_placeholder, created_at, updated_at)
VALUES
  ('pp_01', 'Jensen Huang',        'Jensen',  'Founder & CEO',       'NVIDIA',            'nvidia.com',    'S', 99, 'Santa Clara, CA',  'Founder of NVIDIA; architect of the modern GPU and AI compute era.',      'manual', '["founder","ai","semi"]',     1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_02', 'Satya Nadella',       'Satya',   'Chairman & CEO',      'Microsoft',         'microsoft.com', 'S', 97, 'Redmond, WA',      'Led Microsoft''s enterprise cloud reinvention; steward of Azure + Copilot.', 'manual', '["ceo","cloud","ai"]',       1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_03', 'Sundar Pichai',       'Sundar',  'CEO',                 'Alphabet',          'abc.xyz',       'S', 95, 'Mountain View, CA','CEO of Alphabet; shepherds Search, Android, Gemini.',                       'manual', '["ceo","search","ai"]',      1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_04', 'Phạm Nhật Vượng',     'Vượng',   'Founder & Chairman',  'Vingroup',          'vingroup.net',  'S', 94, 'Hanoi, VN',        'Vietnam''s most successful entrepreneur; founder of Vingroup and VinFast.',  'manual', '["founder","vn-tech","auto"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_05', 'Lisa Su',             'Lisa',    'Chair & CEO',         'AMD',               'amd.com',       'A', 90, 'Austin, TX',       'Architect of AMD''s decade-long turnaround into silicon leadership.',        'manual', '["ceo","semi"]',              1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_06', 'Dario Amodei',        'Dario',   'Co-Founder & CEO',    'Anthropic',         'anthropic.com', 'A', 88, 'San Francisco, CA','Co-founder of Anthropic; frontier-AI safety research pioneer.',              'manual', '["founder","ai","safety"]',   1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_07', 'Patrick Collison',    'Patrick', 'Co-Founder & CEO',    'Stripe',            'stripe.com',    'A', 86, 'San Francisco, CA','Co-founder of Stripe; scaled internet-native payments and developer tooling.', 'manual', '["founder","fintech","dx"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_08', 'Trương Gia Bình',     'Bình',    'Founder & Chairman',  'FPT Corporation',   'fpt.com.vn',    'A', 85, 'Hanoi, VN',        'Founder of FPT; elder statesman of Vietnamese technology.',                  'manual', '["founder","vn-tech"]',       1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_09', 'Andrej Karpathy',     'Andrej',  'Founder',             'Eureka Labs',       'eurekalabs.ai', 'B', 80, 'San Francisco, CA','Founder of Eureka Labs; former Tesla / OpenAI; prolific AI educator.',        'manual', '["founder","ai","education"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_10', 'Chris Lattner',       'Chris',   'Co-Founder & CEO',    'Modular',           'modular.com',   'B', 78, 'Seattle, WA',      'Creator of LLVM + Swift; co-founder of Modular and the Mojo language.',      'manual', '["founder","compilers","ai"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_11', 'Guillermo Rauch',     'Rauch',   'Founder & CEO',       'Vercel',            'vercel.com',    'B', 76, 'San Francisco, CA','Founder of Vercel; shapes modern frontend infrastructure.',                  'manual', '["founder","frontend","dx"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'),
  ('pp_12', 'Nguyễn Hà Đông',      'Đông',    'Founder',             'dotGEARS',          'dotgears.com',  'B', 74, 'Hanoi, VN',        'Creator of Flappy Bird; elder of the Vietnamese indie-game scene.',          'manual', '["founder","games","vn-tech"]', 1, '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z');

-- Primary email + phone for each placeholder. Synthetic, non-routable values.
INSERT OR REPLACE INTO contact_channels (id, contact_id, kind, value, label, is_primary, created_at) VALUES
  ('pch_01_em', 'pp_01', 'email', 'jensen@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_01_ph', 'pp_01', 'phone', '+00 000 000 0001',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_02_em', 'pp_02', 'email', 'satya@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_02_ph', 'pp_02', 'phone', '+00 000 000 0002',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_03_em', 'pp_03', 'email', 'sundar@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_03_ph', 'pp_03', 'phone', '+00 000 000 0003',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_04_em', 'pp_04', 'email', 'vuong@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_04_ph', 'pp_04', 'phone', '+00 000 000 0004',       'work', 0, '2026-04-21T00:00:00Z'),
  ('pch_05_em', 'pp_05', 'email', 'lisa@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_06_em', 'pp_06', 'email', 'dario@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_07_em', 'pp_07', 'email', 'patrick@demo.portrait',  'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_08_em', 'pp_08', 'email', 'binh@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_09_em', 'pp_09', 'email', 'andrej@demo.portrait',   'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_10_em', 'pp_10', 'email', 'chris@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_11_em', 'pp_11', 'email', 'rauch@demo.portrait',    'work', 1, '2026-04-21T00:00:00Z'),
  ('pch_12_em', 'pp_12', 'email', 'dong@demo.portrait',     'work', 1, '2026-04-21T00:00:00Z');
```

- [ ] **Step 2: Apply seed to remote D1**

```bash
npx wrangler d1 execute pensieve-db --remote --file=scripts/portraits-002-placeholders.sql
```

Expected: JSON response with `"success": true, "changes": 28` (12 contacts + 16 channels).

- [ ] **Step 3: Verify placeholder count**

```bash
npx wrangler d1 execute pensieve-db --remote --json --command "SELECT COUNT(*) as n FROM contacts WHERE is_placeholder=1"
```

Expected: `n: 12`.

- [ ] **Step 4: Commit**

```bash
git add scripts/portraits-002-placeholders.sql
git commit -m "feat(portraits): seed 12 placeholder portraits (demo gallery)"
```

---

## Task 4: Shared types

**Files:**
- Create: `src/lib/portraits/types.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/portraits/types.ts`:

```ts
export type TierCode = "S" | "A" | "B" | "C" | "D";

export type ChannelKind =
  | "email"
  | "phone"
  | "telegram"
  | "signal"
  | "whatsapp"
  | "linkedin"
  | "twitter"
  | "x"
  | "facebook"
  | "wechat"
  | "zalo"
  | "url";

export type ContactSource =
  | "manual"
  | "ios"
  | "google"
  | "facebook"
  | "linkedin"
  | "card"
  | "openclaw"
  | "shortcut";

export interface Channel {
  id: string;
  contact_id: string;
  kind: ChannelKind;
  value: string;
  label: string | null;
  is_primary: number;  // 0 or 1
  created_at: string;
}

export interface Contact {
  id: string;
  full_name: string;
  display_name: string | null;
  title: string | null;
  company: string | null;
  company_domain: string | null;
  photo_key: string | null;
  prestige_tier: TierCode;
  tier_score: number;
  location: string | null;
  bio: string | null;
  source: ContactSource;
  external_ids: string | null;  // JSON string
  tags: string | null;           // JSON string
  birthday: string | null;
  is_placeholder: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactWithChannels extends Contact {
  channels: Channel[];
}

export interface ListContactsOptions {
  includePlaceholders: boolean;
  onlyPlaceholders: boolean;
  search?: string;
  tiers?: TierCode[];
}

export interface CreateContactInput {
  full_name: string;
  display_name?: string | null;
  title?: string | null;
  company?: string | null;
  company_domain?: string | null;
  prestige_tier: TierCode;
  tier_score?: number;
  location?: string | null;
  bio?: string | null;
  source?: ContactSource;
  tags?: string[];
  channels?: Array<{
    kind: ChannelKind;
    value: string;
    label?: string;
    is_primary?: boolean;
  }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/portraits/types.ts
git commit -m "feat(portraits): shared types (Contact, Channel, TierCode)"
```

---

## Task 5: `requireAdmin` helper

**Files:**
- Create: `src/lib/portraits/auth.ts`
- Test: `tests/portraits/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/portraits/auth.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminResponse } from "../../src/lib/portraits/auth";

test("isAdminResponse returns true for role 50", () => {
  const body = { user: { role: 50, email: "loc@example.com" } };
  assert.equal(isAdminResponse(200, body), true);
});

test("isAdminResponse returns false for role 40 (Editor)", () => {
  const body = { user: { role: 40, email: "editor@example.com" } };
  assert.equal(isAdminResponse(200, body), false);
});

test("isAdminResponse returns false for 401 response", () => {
  assert.equal(isAdminResponse(401, null), false);
});

test("isAdminResponse returns false for missing user", () => {
  assert.equal(isAdminResponse(200, {}), false);
});

test("isAdminResponse returns false for role undefined", () => {
  assert.equal(isAdminResponse(200, { user: { email: "x" } }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/portraits/auth.test.ts
```

Expected: FAIL — module `../../src/lib/portraits/auth` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/portraits/auth.ts`:

```ts
import type { AstroGlobal } from "astro";

const ADMIN_ROLE_THRESHOLD = 50;

export interface AuthUser {
  role: number;
  email: string;
}

export interface AuthCheckResult {
  admin: boolean;
  user: AuthUser | null;
}

export function isAdminResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 200) return false;
  if (!body || typeof body !== "object") return false;
  const user = (body as { user?: { role?: unknown } }).user;
  if (!user || typeof user !== "object") return false;
  const role = (user as { role?: unknown }).role;
  return typeof role === "number" && role >= ADMIN_ROLE_THRESHOLD;
}

export async function requireAdmin(
  Astro: AstroGlobal,
): Promise<AuthCheckResult> {
  const cookie = Astro.request.headers.get("cookie") ?? "";
  if (!cookie) return { admin: false, user: null };

  let res: Response;
  try {
    res = await fetch(new URL("/_emdash/api/auth/me", Astro.url), {
      headers: { cookie },
    });
  } catch {
    return { admin: false, user: null };
  }

  let body: unknown = null;
  if (res.ok) {
    try {
      body = await res.json();
    } catch {
      // non-JSON response — treat as not authed
      return { admin: false, user: null };
    }
  }

  const admin = isAdminResponse(res.status, body);
  const user = admin ? (body as { user: AuthUser }).user : null;
  return { admin, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/portraits/auth.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portraits/auth.ts tests/portraits/auth.test.ts
git commit -m "feat(portraits): requireAdmin helper (proxies EmDash session)"
```

---

## Task 6: DB query helpers

**Files:**
- Create: `src/lib/portraits/db.ts`
- Test: `tests/portraits/db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/portraits/db.test.ts`. This is an integration test that talks to the real remote D1 (matching the `animations/schema.test.ts` pattern). It uses `execFileSync` so it doesn't require spinning up a Worker.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function d1(sql: string) {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "pensieve-db",
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(out) as Array<{ results: any[] }>;
}

test("placeholder contacts exist (12 rows)", () => {
  const parsed = d1(
    "SELECT COUNT(*) AS n FROM contacts WHERE is_placeholder=1 AND deleted_at IS NULL",
  );
  assert.equal(parsed[0].results[0].n, 12);
});

test("placeholder S-tier has 4 rows", () => {
  const parsed = d1(
    "SELECT COUNT(*) AS n FROM contacts WHERE is_placeholder=1 AND prestige_tier='S' AND deleted_at IS NULL",
  );
  assert.equal(parsed[0].results[0].n, 4);
});

test("every placeholder contact has at least one email channel", () => {
  const parsed = d1(`
    SELECT c.id
    FROM contacts c
    LEFT JOIN contact_channels ch
      ON ch.contact_id = c.id AND ch.kind = 'email'
    WHERE c.is_placeholder=1 AND c.deleted_at IS NULL
    GROUP BY c.id
    HAVING COUNT(ch.id) = 0
  `);
  assert.deepEqual(parsed[0].results, []);
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- tests/portraits/db.test.ts
```

Expected: 3 tests pass (the migration + seed already ran).

- [ ] **Step 3: Write the db helpers**

Create `src/lib/portraits/db.ts`:

```ts
import type {
  Contact,
  ContactWithChannels,
  Channel,
  CreateContactInput,
  ListContactsOptions,
  TierCode,
} from "./types";

type D1 = import("@cloudflare/workers-types").D1Database;

export async function listContacts(
  db: D1,
  opts: ListContactsOptions,
): Promise<Contact[]> {
  const clauses: string[] = ["deleted_at IS NULL"];
  const binds: unknown[] = [];

  if (opts.onlyPlaceholders) {
    clauses.push("is_placeholder = 1");
  } else if (!opts.includePlaceholders) {
    clauses.push("is_placeholder = 0");
  }

  if (opts.tiers && opts.tiers.length > 0) {
    const placeholders = opts.tiers.map(() => "?").join(",");
    clauses.push(`prestige_tier IN (${placeholders})`);
    binds.push(...opts.tiers);
  }

  if (opts.search && opts.search.trim()) {
    clauses.push(
      "(full_name LIKE ? OR company LIKE ? OR tags LIKE ?)",
    );
    const q = `%${opts.search.trim()}%`;
    binds.push(q, q, q);
  }

  const sql =
    `SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ` +
    `ORDER BY CASE prestige_tier WHEN 'S' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END, ` +
    `tier_score DESC, updated_at DESC`;

  const stmt = db.prepare(sql);
  const rs = binds.length ? await stmt.bind(...binds).all<Contact>() : await stmt.all<Contact>();
  return (rs.results ?? []) as Contact[];
}

export async function getContact(
  db: D1,
  id: string,
): Promise<ContactWithChannels | null> {
  const c = await db
    .prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<Contact>();
  if (!c) return null;

  const ch = await db
    .prepare(
      "SELECT * FROM contact_channels WHERE contact_id = ? ORDER BY is_primary DESC, created_at ASC",
    )
    .bind(id)
    .all<Channel>();

  return { ...c, channels: (ch.results ?? []) as Channel[] };
}

export async function createContact(
  db: D1,
  input: CreateContactInput,
): Promise<ContactWithChannels> {
  const now = new Date().toISOString();
  const id = ulid();

  const tags = input.tags ? JSON.stringify(input.tags) : null;
  const source = input.source ?? "manual";
  const tier_score = input.tier_score ?? 50;

  await db
    .prepare(
      `INSERT INTO contacts
         (id, full_name, display_name, title, company, company_domain,
          prestige_tier, tier_score, location, bio, source, tags,
          is_placeholder, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    )
    .bind(
      id,
      input.full_name,
      input.display_name ?? null,
      input.title ?? null,
      input.company ?? null,
      input.company_domain ?? null,
      input.prestige_tier,
      tier_score,
      input.location ?? null,
      input.bio ?? null,
      source,
      tags,
      now,
      now,
    )
    .run();

  const channels: Channel[] = [];
  if (input.channels) {
    for (const ch of input.channels) {
      const chId = ulid();
      await db
        .prepare(
          `INSERT INTO contact_channels
             (id, contact_id, kind, value, label, is_primary, created_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          chId,
          id,
          ch.kind,
          ch.value,
          ch.label ?? null,
          ch.is_primary ? 1 : 0,
          now,
        )
        .run();
      channels.push({
        id: chId,
        contact_id: id,
        kind: ch.kind,
        value: ch.value,
        label: ch.label ?? null,
        is_primary: ch.is_primary ? 1 : 0,
        created_at: now,
      });
    }
  }

  const full = await getContact(db, id);
  if (!full) throw new Error("createContact: row vanished after insert");
  return full;
}

// 26-char Crockford-base32 ULID, monotonic within process.
// Kept inline to avoid a dependency; hot path is admin-only.
let _lastMs = 0;
let _lastRand = new Uint8Array(10);
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  const now = Date.now();
  let rand: Uint8Array;
  if (now === _lastMs) {
    // monotonic increment
    rand = new Uint8Array(_lastRand);
    for (let i = 9; i >= 0; i--) {
      rand[i] = (rand[i] + 1) & 0xff;
      if (rand[i] !== 0) break;
    }
  } else {
    rand = crypto.getRandomValues(new Uint8Array(10));
    _lastMs = now;
  }
  _lastRand = rand;

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
    while (bits >= 5) {
      bits -= 5;
      randStr += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return time + randStr;
}
```

- [ ] **Step 4: Re-run tests**

```bash
npm test -- tests/portraits/db.test.ts
```

Expected: 3 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portraits/db.ts tests/portraits/db.test.ts
git commit -m "feat(portraits): D1 query helpers (list/get/create + ULID)"
```

---

## Task 7: `GET /api/portraits` and `POST /api/portraits`

**Files:**
- Create: `src/pages/api/portraits/index.ts`
- Test: `tests/portraits/api.test.ts` (smoke only — full API tests need a running Worker)

- [ ] **Step 1: Write the handler**

Create `src/pages/api/portraits/index.ts`:

```ts
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
```

- [ ] **Step 2: Write the API smoke test**

Create `tests/portraits/api.test.ts`. It spawns the dev server and hits `GET /api/portraits` unauthenticated to verify guest shape. Since the dev server isn't ephemeral in tests, this test is gated on the `PORTRAITS_SMOKE_BASE_URL` env var — set it to skip when running locally without a server.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.PORTRAITS_SMOKE_BASE_URL;

test("GET /api/portraits returns guest demo shape", { skip: !BASE }, async () => {
  const res = await fetch(`${BASE}/api/portraits`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { contacts: any[]; guest: boolean };
  assert.equal(body.guest, true);
  assert.equal(body.contacts.length, 12);
});

test("POST /api/portraits without session returns 403", { skip: !BASE }, async () => {
  const res = await fetch(`${BASE}/api/portraits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Test", prestige_tier: "D" }),
  });
  assert.equal(res.status, 403);
});
```

- [ ] **Step 3: Manually verify by starting dev server**

```bash
npx emdash dev
```

Then in another terminal:

```bash
curl -s http://localhost:4321/api/portraits | head -c 400
```

Expected: JSON with `"guest":true` and a `contacts` array of length 12.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/portraits/index.ts tests/portraits/api.test.ts
git commit -m "feat(portraits): GET list + POST create API (admin-gated)"
```

---

## Task 8: `GET /api/portraits/:id`

**Files:**
- Create: `src/pages/api/portraits/[id].ts`

- [ ] **Step 1: Write the handler**

Create `src/pages/api/portraits/[id].ts`:

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";
import { getContact } from "../../../lib/portraits/db";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const id = ctx.params.id;
  if (!id || typeof id !== "string") {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await requireAdmin(ctx as any);
  const db = (env as any).DB;
  const contact = await getContact(db, id);

  if (!contact) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guests can read placeholder rows only; everything else is 404 to avoid leaking existence.
  if (!auth.admin && contact.is_placeholder !== 1) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheHeader =
    !auth.admin && contact.is_placeholder === 1
      ? "public, max-age=3600, s-maxage=3600"
      : "private, no-store";

  return new Response(JSON.stringify({ contact }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheHeader,
    },
  });
};
```

- [ ] **Step 2: Manually verify with dev server**

Start `npx emdash dev`. Then:

```bash
curl -s http://localhost:4321/api/portraits/pp_01 | head -c 400
```

Expected: JSON `{"contact":{"id":"pp_01", ...}}` with channels array including `jensen@demo.portrait`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/api/portraits/nonexistent
```

Expected: `404`.

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/portraits/[id].ts
git commit -m "feat(portraits): GET /api/portraits/:id with guest placeholder access"
```

---

## Task 9: Tier frame components

**Files:**
- Create: `src/components/portraits/frames/FrameGold.astro`
- Create: `src/components/portraits/frames/FrameSilver.astro`
- Create: `src/components/portraits/frames/FrameBronze.astro`
- Create: `src/components/portraits/frames/FrameEtched.astro`

- [ ] **Step 1: Write the gold (S-tier) frame**

Create `src/components/portraits/frames/FrameGold.astro`:

```astro
---
interface Props { size?: number }
const { size = 320 } = Astro.props;
---

<svg
  class="frame frame-gold"
  width={size}
  height={size}
  viewBox="0 0 100 100"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <defs>
    <linearGradient id="gold-grad" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#e7c76b" />
      <stop offset="0.5" stop-color="#f8e08c" />
      <stop offset="1" stop-color="#b08830" />
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="98" height="98" rx="3"
        fill="none" stroke="url(#gold-grad)" stroke-width="2" />
  <rect x="3.5" y="3.5" width="93" height="93" rx="2"
        fill="none" stroke="url(#gold-grad)" stroke-width="0.35" opacity="0.7" />
  <!-- corner flourishes -->
  <g fill="url(#gold-grad)" opacity="0.9">
    <path d="M1 1 L6 1 L1 6 Z" />
    <path d="M99 1 L94 1 L99 6 Z" />
    <path d="M1 99 L6 99 L1 94 Z" />
    <path d="M99 99 L94 99 L99 94 Z" />
  </g>
</svg>

<style>
  .frame-gold { position: absolute; inset: 0; pointer-events: none; }
  .frame-gold { filter: drop-shadow(0 0 8px rgba(231, 199, 107, 0.25)); }
</style>
```

- [ ] **Step 2: Write the silver (A-tier) frame**

Create `src/components/portraits/frames/FrameSilver.astro`:

```astro
---
interface Props { size?: number }
const { size = 240 } = Astro.props;
---

<svg class="frame frame-silver" width={size} height={size}
     viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="silver-grad" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#c8cbd0" />
      <stop offset="0.5" stop-color="#e6e8ea" />
      <stop offset="1" stop-color="#8b8f95" />
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="97" height="97" rx="2"
        fill="none" stroke="url(#silver-grad)" stroke-width="1.4" />
  <rect x="4" y="4" width="92" height="92" rx="1.5"
        fill="none" stroke="url(#silver-grad)" stroke-width="0.3" opacity="0.6" />
</svg>

<style>
  .frame-silver { position: absolute; inset: 0; pointer-events: none; }
</style>
```

- [ ] **Step 3: Write the bronze (B-tier) frame**

Create `src/components/portraits/frames/FrameBronze.astro`:

```astro
---
interface Props { size?: number }
const { size = 180 } = Astro.props;
---

<svg class="frame frame-bronze" width={size} height={size}
     viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="bronze-grad" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#a36a36" />
      <stop offset="0.5" stop-color="#cd8a4e" />
      <stop offset="1" stop-color="#70451f" />
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="97" height="97" rx="1.5"
        fill="none" stroke="url(#bronze-grad)" stroke-width="1.1" />
</svg>

<style>
  .frame-bronze { position: absolute; inset: 0; pointer-events: none; }
</style>
```

- [ ] **Step 4: Write the etched (C-tier) frame**

Create `src/components/portraits/frames/FrameEtched.astro`:

```astro
---
interface Props { size?: number }
const { size = 140 } = Astro.props;
---

<svg class="frame frame-etched" width={size} height={size}
     viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <rect x="1" y="1" width="98" height="98" rx="1"
        fill="none" stroke="#555" stroke-width="0.6"
        stroke-dasharray="1.5 1" opacity="0.8" />
</svg>

<style>
  .frame-etched { position: absolute; inset: 0; pointer-events: none; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/portraits/frames/
git commit -m "feat(portraits): S/A/B/C tier SVG frames"
```

---

## Task 10: `PortraitCard` component

**Files:**
- Create: `src/components/portraits/PortraitCard.astro`

- [ ] **Step 1: Write the component**

Create `src/components/portraits/PortraitCard.astro`:

```astro
---
import FrameGold   from "./frames/FrameGold.astro";
import FrameSilver from "./frames/FrameSilver.astro";
import FrameBronze from "./frames/FrameBronze.astro";
import FrameEtched from "./frames/FrameEtched.astro";
import type { Contact } from "../../lib/portraits/types";

interface Props {
  contact: Contact;
  isAdminView: boolean;
}

const { contact, isAdminView } = Astro.props;

const tierSizes = { S: 320, A: 240, B: 180, C: 140, D: 120 } as const;
const size = tierSizes[contact.prestige_tier];

const tierNames = {
  S: "Founder",
  A: "Headmaster",
  B: "Professor",
  C: "Scholar",
  D: "Visitor",
} as const;

const detailHref = `/room-of-requirement/portraits/${contact.id}`;

// Initials fallback
const initials = contact.full_name
  .split(" ")
  .map((p) => p[0] ?? "")
  .join("")
  .slice(0, 2)
  .toUpperCase();
---

<a
  href={detailHref}
  class={`portrait-card tier-${contact.prestige_tier}`}
  style={`--portrait-size: ${size}px`}
  data-tier={contact.prestige_tier}
>
  <div class="portrait-frame">
    {contact.prestige_tier === "S" && <FrameGold   size={size} />}
    {contact.prestige_tier === "A" && <FrameSilver size={size} />}
    {contact.prestige_tier === "B" && <FrameBronze size={size} />}
    {contact.prestige_tier === "C" && <FrameEtched size={size} />}

    <div class="portrait-photo" aria-hidden={!!contact.photo_key}>
      {contact.photo_key ? (
        <img src={`/api/portraits/photos/${contact.id}`} alt="" loading="lazy" />
      ) : (
        <span class="initials">{initials}</span>
      )}
    </div>
  </div>

  <div class="portrait-meta">
    <div class="portrait-name">{contact.display_name ?? contact.full_name}</div>
    {contact.title || contact.company ? (
      <div class="portrait-title">
        {contact.title}{contact.title && contact.company ? " · " : ""}{contact.company}
      </div>
    ) : null}
    <div class="portrait-tier-row">
      <span class="tier-badge">{tierNames[contact.prestige_tier]}</span>
      {contact.is_placeholder === 1 && !isAdminView ? (
        <span class="demo-ribbon">★ demo</span>
      ) : null}
    </div>
  </div>
</a>

<style>
  .portrait-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.25rem;
    text-decoration: none;
    color: inherit;
    transition: transform 180ms ease;
  }
  .portrait-card:hover { transform: translateY(-2px); }

  .portrait-frame {
    position: relative;
    width: var(--portrait-size);
    height: var(--portrait-size);
  }
  .portrait-photo {
    position: absolute;
    inset: 7%;
    overflow: hidden;
    border-radius: 4px;
    background: #1a1a1a;
    display: grid;
    place-items: center;
  }
  .portrait-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .initials {
    font-family: "Inter Tight", sans-serif;
    font-weight: 600;
    font-size: calc(var(--portrait-size) * 0.2);
    color: #666;
    letter-spacing: 0.05em;
  }

  .portrait-meta { max-width: var(--portrait-size); }
  .portrait-name {
    font-family: "Inter Tight", sans-serif;
    font-weight: 600;
    font-size: 1rem;
    color: #e8e6e0;
    line-height: 1.2;
  }
  .tier-S .portrait-name { font-size: 1.25rem; letter-spacing: -0.01em; }
  .tier-A .portrait-name { font-size: 1.125rem; }
  .portrait-title {
    font-size: 0.8125rem;
    color: #9a968c;
    margin-top: 0.125rem;
    line-height: 1.3;
  }
  .portrait-tier-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.375rem;
    align-items: center;
  }
  .tier-badge {
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8a877e;
    border: 1px solid #3a3a3a;
    padding: 0.1rem 0.4rem;
    border-radius: 2px;
  }
  .demo-ribbon {
    font-size: 0.6875rem;
    color: #d4a89a;
    letter-spacing: 0.04em;
  }

  /* S-tier candle glow */
  .tier-S .portrait-frame {
    animation: candle 5s ease-in-out infinite;
  }
  @keyframes candle {
    0%, 100% { filter: drop-shadow(0 0 10px rgba(231,199,107,0.3)); }
    50%      { filter: drop-shadow(0 0 14px rgba(231,199,107,0.45)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tier-S .portrait-frame { animation: none; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portraits/PortraitCard.astro
git commit -m "feat(portraits): PortraitCard component (tier-sized, initials fallback)"
```

---

## Task 11: `TierSection` component

**Files:**
- Create: `src/components/portraits/TierSection.astro`

- [ ] **Step 1: Write the component**

Create `src/components/portraits/TierSection.astro`:

```astro
---
import PortraitCard from "./PortraitCard.astro";
import type { Contact, TierCode } from "../../lib/portraits/types";

interface Props {
  tier: TierCode;
  contacts: Contact[];
  isAdminView: boolean;
}

const { tier, contacts, isAdminView } = Astro.props;

const headings: Record<TierCode, { title: string; subtitle: string }> = {
  S: { title: "Main Hall",    subtitle: "Founders" },
  A: { title: "Headmasters",  subtitle: "" },
  B: { title: "Professors",   subtitle: "" },
  C: { title: "Scholars",     subtitle: "" },
  D: { title: "Corridor",     subtitle: "Visitors" },
};

const h = headings[tier];
---

{contacts.length > 0 && (
  <section class={`tier-section tier-${tier}`}>
    <header class="tier-header">
      <h2 class="tier-title">{h.title}</h2>
      {h.subtitle && <span class="tier-subtitle">— {h.subtitle}</span>}
      <span class="tier-count">({contacts.length})</span>
    </header>
    <div class="tier-grid">
      {contacts.map((c) => (
        <PortraitCard contact={c} isAdminView={isAdminView} />
      ))}
    </div>
  </section>
)}

<style>
  .tier-section {
    padding: 2rem 0;
    border-top: 1px solid #1f1f1f;
  }
  .tier-section:first-child { border-top: 0; padding-top: 0; }

  .tier-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .tier-title {
    font-family: "Inter Tight", sans-serif;
    font-weight: 500;
    font-size: 0.875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #9a968c;
  }
  .tier-subtitle {
    color: #6a665e;
    font-size: 0.875rem;
  }
  .tier-count {
    color: #6a665e;
    font-size: 0.8125rem;
    margin-left: auto;
  }

  .tier-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem 2.5rem;
    align-items: flex-start;
  }
  .tier-S .tier-grid { gap: 3rem 4rem; }
  .tier-C .tier-grid { gap: 1.25rem 1.5rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portraits/TierSection.astro
git commit -m "feat(portraits): TierSection grouping (Main Hall / Headmasters / ...)"
```

---

## Task 12: `CorridorTable` component (D-tier)

**Files:**
- Create: `src/components/portraits/CorridorTable.astro`

- [ ] **Step 1: Write the component**

Create `src/components/portraits/CorridorTable.astro`:

```astro
---
import type { Contact } from "../../lib/portraits/types";

interface Props { contacts: Contact[] }

const { contacts } = Astro.props;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
---

{contacts.length > 0 && (
  <section class="tier-section tier-D">
    <header class="tier-header">
      <h2 class="tier-title">Corridor</h2>
      <span class="tier-subtitle">— Visitors</span>
      <span class="tier-count">({contacts.length})</span>
    </header>
    <table class="corridor-table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Company</th>
          <th scope="col" class="last-seen">Updated</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => (
          <tr>
            <td>
              <a href={`/room-of-requirement/portraits/${c.id}`}>
                {c.display_name ?? c.full_name}
              </a>
            </td>
            <td>{c.company ?? "—"}</td>
            <td class="last-seen">{timeAgo(c.updated_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}

<style>
  .tier-section { padding: 2rem 0; border-top: 1px solid #1f1f1f; }
  .tier-header {
    display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 1rem;
  }
  .tier-title {
    font-family: "Inter Tight", sans-serif; font-weight: 500;
    font-size: 0.875rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: #9a968c;
  }
  .tier-subtitle { color: #6a665e; font-size: 0.875rem; }
  .tier-count { color: #6a665e; font-size: 0.8125rem; margin-left: auto; }

  .corridor-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  .corridor-table th, .corridor-table td {
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #1a1a1a;
  }
  .corridor-table th {
    font-weight: 500;
    color: #6a665e;
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
  }
  .corridor-table tbody tr:hover { background: #141414; }
  .corridor-table a { color: #e8e6e0; text-decoration: none; }
  .corridor-table a:hover { text-decoration: underline; }
  .last-seen { color: #8a877e; }

  @media (max-width: 640px) {
    .corridor-table th:nth-child(2),
    .corridor-table td:nth-child(2) { display: none; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portraits/CorridorTable.astro
git commit -m "feat(portraits): CorridorTable component for D-tier compact rows"
```

---

## Task 13: Guest banner component

**Files:**
- Create: `src/components/portraits/GuestBanner.astro`

- [ ] **Step 1: Write the component**

Create `src/components/portraits/GuestBanner.astro`:

```astro
---
// No props — simple ribbon explaining the demo state.
---

<div class="guest-banner" role="note">
  <span class="lock">🔒</span>
  <strong>Private collection.</strong>
  <span>Showing a demo gallery of public-figure portraits. Sign in as admin for the real rolodex.</span>
</div>

<style>
  .guest-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background: linear-gradient(90deg, rgba(212, 168, 154, 0.08), transparent);
    border-left: 2px solid #d4a89a;
    border-radius: 2px;
    color: #bdb8ac;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }
  .guest-banner strong { color: #e8e6e0; font-weight: 500; }
  .lock { font-size: 1rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portraits/GuestBanner.astro
git commit -m "feat(portraits): guest banner ribbon"
```

---

## Task 14: Gallery index page

**Files:**
- Create: `src/pages/room-of-requirement/portraits/index.astro`

- [ ] **Step 1: Write the page**

Create `src/pages/room-of-requirement/portraits/index.astro`:

```astro
---
export const prerender = false;

import { env } from "cloudflare:workers";
import Base from "../../../layouts/Base.astro";
import TierSection from "../../../components/portraits/TierSection.astro";
import CorridorTable from "../../../components/portraits/CorridorTable.astro";
import GuestBanner from "../../../components/portraits/GuestBanner.astro";
import { requireAdmin } from "../../../lib/portraits/auth";
import { listContacts } from "../../../lib/portraits/db";
import type { Contact, TierCode } from "../../../lib/portraits/types";

const auth = await requireAdmin(Astro);
const db = (env as any).DB;

const contacts: Contact[] = await listContacts(db, {
  includePlaceholders: !auth.admin,
  onlyPlaceholders: !auth.admin,
});

// Bucket by tier
const buckets: Record<TierCode, Contact[]> = { S: [], A: [], B: [], C: [], D: [] };
for (const c of contacts) buckets[c.prestige_tier].push(c);

const total = contacts.length;

// Cache: guest cached 1h, admin never cached.
Astro.cache.set({
  maxAge: auth.admin ? 0 : 3600,
  sharedMaxAge: auth.admin ? 0 : 3600,
  cacheDirectives: auth.admin ? ["private", "no-store"] : ["public"],
});
---

<Base title="Portraits — Room of Requirement" description="A private rolodex of notable figures.">
  <main class="portraits-page">
    <header class="portraits-hero">
      <h1>Portraits</h1>
      <p class="hero-sub">
        A gallery of the people who shape the work. {total} {total === 1 ? "portrait" : "portraits"}.
      </p>
      {auth.admin && (
        <div class="admin-actions">
          <a class="btn btn-primary" href="/room-of-requirement/portraits/add">＋ New portrait</a>
        </div>
      )}
    </header>

    {!auth.admin && <GuestBanner />}

    {buckets.S.length > 0 && <TierSection tier="S" contacts={buckets.S} isAdminView={auth.admin} />}
    {buckets.A.length > 0 && <TierSection tier="A" contacts={buckets.A} isAdminView={auth.admin} />}
    {buckets.B.length > 0 && <TierSection tier="B" contacts={buckets.B} isAdminView={auth.admin} />}
    {buckets.C.length > 0 && <TierSection tier="C" contacts={buckets.C} isAdminView={auth.admin} />}
    {buckets.D.length > 0 && <CorridorTable contacts={buckets.D} />}

    {total === 0 && (
      <div class="empty">
        <p>No portraits yet. {auth.admin ? "Add your first contact to start the gallery." : ""}</p>
      </div>
    )}
  </main>
</Base>

<style>
  .portraits-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.25rem 5rem;
  }
  .portraits-hero {
    padding: 2rem 0 1.5rem;
    border-bottom: 1px solid #1a1a1a;
  }
  .portraits-hero h1 {
    font-family: "Inter Tight", sans-serif;
    font-weight: 500;
    font-size: clamp(2rem, 5vw, 3rem);
    letter-spacing: -0.02em;
    margin: 0;
    color: #e8e6e0;
  }
  .hero-sub {
    color: #8a877e;
    margin: 0.5rem 0 0;
    font-size: 1rem;
  }
  .admin-actions { margin-top: 1rem; }
  .btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    border: 1px solid #3a3a3a;
    border-radius: 3px;
    color: #e8e6e0;
    text-decoration: none;
    font-size: 0.9rem;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .btn:hover { border-color: #6a665e; background: #161616; }
  .btn-primary { border-color: #d4a89a; color: #d4a89a; }
  .btn-primary:hover { background: rgba(212, 168, 154, 0.08); }

  .empty {
    padding: 4rem 0;
    text-align: center;
    color: #6a665e;
  }
</style>
```

- [ ] **Step 2: Smoke-test in the browser**

Start `npx emdash dev`. Navigate to `http://localhost:4321/room-of-requirement/portraits`.

Expected:
- Hero "Portraits" + subtitle "12 portraits".
- Guest banner visible.
- S-tier section "Main Hall — Founders (4)" with Jensen, Satya, Sundar, Vượng each in gold frame.
- A/B sections with silver/bronze frames.
- Each card shows demo ribbon.

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/portraits/index.astro
git commit -m "feat(portraits): gallery page with tier-banded layout (admin/guest)"
```

---

## Task 15: Manual add form

**Files:**
- Create: `src/pages/room-of-requirement/portraits/add.astro`

- [ ] **Step 1: Write the page**

Create `src/pages/room-of-requirement/portraits/add.astro`:

```astro
---
export const prerender = false;

import Base from "../../../layouts/Base.astro";
import { requireAdmin } from "../../../lib/portraits/auth";

const auth = await requireAdmin(Astro);
if (!auth.admin) {
  return Astro.redirect("/room-of-requirement/portraits", 302);
}

Astro.cache.set({ cacheDirectives: ["private", "no-store"] });
---

<Base title="New portrait" description="Add a contact to the private rolodex.">
  <main class="add-page">
    <header class="add-hero">
      <a class="back-link" href="/room-of-requirement/portraits">← Portraits</a>
      <h1>New portrait</h1>
    </header>

    <form id="portrait-form" class="add-form">
      <label class="field">
        <span>Full name <span class="req">*</span></span>
        <input type="text" name="full_name" required maxlength="200" />
      </label>

      <label class="field">
        <span>Display name</span>
        <input type="text" name="display_name" maxlength="120" placeholder="Optional short form" />
      </label>

      <div class="row">
        <label class="field">
          <span>Title</span>
          <input type="text" name="title" maxlength="120" />
        </label>
        <label class="field">
          <span>Company</span>
          <input type="text" name="company" maxlength="120" />
        </label>
      </div>

      <label class="field">
        <span>Prestige tier <span class="req">*</span></span>
        <select name="prestige_tier" required>
          <option value="S">S — Founder</option>
          <option value="A">A — Headmaster</option>
          <option value="B">B — Professor</option>
          <option value="C" selected>C — Scholar</option>
          <option value="D">D — Visitor</option>
        </select>
      </label>

      <label class="field">
        <span>Tier score (0–100, default 50)</span>
        <input type="number" name="tier_score" min="0" max="100" value="50" />
      </label>

      <label class="field">
        <span>Primary email</span>
        <input type="email" name="primary_email" maxlength="200" />
      </label>

      <label class="field">
        <span>Primary phone</span>
        <input type="tel" name="primary_phone" maxlength="40" />
      </label>

      <label class="field">
        <span>Bio</span>
        <textarea name="bio" rows="3" maxlength="500"></textarea>
      </label>

      <label class="field">
        <span>Tags (comma-separated)</span>
        <input type="text" name="tags" placeholder="founder, ai, vn-tech" />
      </label>

      <div class="actions">
        <button type="submit" class="btn btn-primary">Save portrait</button>
        <a class="btn" href="/room-of-requirement/portraits">Cancel</a>
      </div>

      <p id="error" class="error" hidden></p>
    </form>
  </main>
</Base>

<script>
  const form = document.getElementById("portrait-form") as HTMLFormElement;
  const errEl = document.getElementById("error") as HTMLParagraphElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const fd = new FormData(form);
    const channels: Array<{ kind: "email" | "phone"; value: string; is_primary: boolean }> = [];
    const email = String(fd.get("primary_email") ?? "").trim();
    const phone = String(fd.get("primary_phone") ?? "").trim();
    if (email) channels.push({ kind: "email", value: email, is_primary: true });
    if (phone) channels.push({ kind: "phone", value: phone, is_primary: !email });

    const tagsRaw = String(fd.get("tags") ?? "").trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    const body = {
      full_name: String(fd.get("full_name") ?? "").trim(),
      display_name: String(fd.get("display_name") ?? "").trim() || undefined,
      title:         String(fd.get("title")         ?? "").trim() || undefined,
      company:       String(fd.get("company")       ?? "").trim() || undefined,
      prestige_tier: String(fd.get("prestige_tier") ?? "C"),
      tier_score:    Number(fd.get("tier_score")    ?? 50),
      bio:           String(fd.get("bio")           ?? "").trim() || undefined,
      tags,
      channels,
    };

    const res = await fetch("/api/portraits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      errEl.textContent = `Save failed: ${data.error ?? res.statusText}`;
      errEl.hidden = false;
      return;
    }

    const { contact } = (await res.json()) as { contact: { id: string } };
    window.location.href = `/room-of-requirement/portraits/${contact.id}`;
  });
</script>

<style>
  .add-page { max-width: 640px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
  .add-hero { margin-bottom: 1.5rem; }
  .back-link {
    color: #8a877e; font-size: 0.875rem; text-decoration: none;
  }
  .back-link:hover { color: #d4a89a; }
  .add-hero h1 {
    font-family: "Inter Tight", sans-serif; font-weight: 500;
    font-size: 2rem; margin: 0.5rem 0 0;
  }
  .add-form { display: flex; flex-direction: column; gap: 1.25rem; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 500px) { .row { grid-template-columns: 1fr; } }
  .field { display: flex; flex-direction: column; gap: 0.35rem; }
  .field span { font-size: 0.8125rem; color: #8a877e; letter-spacing: 0.04em; }
  .req { color: #d4a89a; }
  input, select, textarea {
    background: #111; border: 1px solid #2a2a2a; color: #e8e6e0;
    padding: 0.55rem 0.7rem; border-radius: 3px; font: inherit;
  }
  input:focus, select:focus, textarea:focus {
    border-color: #d4a89a; outline: none;
  }
  textarea { resize: vertical; }
  .actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
  .btn {
    padding: 0.55rem 1.1rem; border: 1px solid #3a3a3a; border-radius: 3px;
    color: #e8e6e0; text-decoration: none; font: inherit; cursor: pointer;
    background: transparent;
  }
  .btn:hover { border-color: #6a665e; background: #161616; }
  .btn-primary { border-color: #d4a89a; color: #d4a89a; }
  .btn-primary:hover { background: rgba(212, 168, 154, 0.08); }
  .error { color: #e57373; font-size: 0.875rem; }
</style>
```

- [ ] **Step 2: Smoke-test**

Start dev server, log in as admin (`/_emdash/admin/login`), visit `/room-of-requirement/portraits/add`.

Fill:
- Full name: "Test Contact"
- Prestige tier: C
- Primary email: "test@example.com"

Submit. Expected: redirects to `/room-of-requirement/portraits/<new-ulid>` — detail page (next task).

As guest (logged out), visit `/add`. Expected: redirects to gallery.

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/portraits/add.astro
git commit -m "feat(portraits): manual add form with primary email/phone"
```

---

## Task 16: Detail page (Overview tab)

**Files:**
- Create: `src/pages/room-of-requirement/portraits/[id].astro`

- [ ] **Step 1: Write the page**

Create `src/pages/room-of-requirement/portraits/[id].astro`:

```astro
---
export const prerender = false;

import { env } from "cloudflare:workers";
import Base from "../../../layouts/Base.astro";
import { requireAdmin } from "../../../lib/portraits/auth";
import { getContact } from "../../../lib/portraits/db";
import type { ContactWithChannels } from "../../../lib/portraits/types";

const auth = await requireAdmin(Astro);
const db = (env as any).DB;
const id = Astro.params.id;

if (typeof id !== "string" || !id) {
  return new Response("Bad request", { status: 400 });
}

const contact: ContactWithChannels | null = await getContact(db, id);

// Guests can only read placeholder rows. 404 on anything else to avoid existence-leak.
if (!contact || (!auth.admin && contact.is_placeholder !== 1)) {
  return new Response("Not found", { status: 404 });
}

const tags = contact.tags ? (JSON.parse(contact.tags) as string[]) : [];
const primaryEmail = contact.channels.find((c) => c.kind === "email" && c.is_primary === 1)
  ?? contact.channels.find((c) => c.kind === "email");
const primaryPhone = contact.channels.find((c) => c.kind === "phone" && c.is_primary === 1)
  ?? contact.channels.find((c) => c.kind === "phone");

const tierNames = {
  S: "Founder", A: "Headmaster", B: "Professor", C: "Scholar", D: "Visitor",
} as const;

Astro.cache.set({
  maxAge: auth.admin ? 0 : 3600,
  sharedMaxAge: auth.admin ? 0 : 3600,
  cacheDirectives: auth.admin ? ["private", "no-store"] : ["public"],
});
---

<Base title={`${contact.display_name ?? contact.full_name} — Portrait`} description={contact.bio ?? ""}>
  <main class="detail-page">
    <header class="detail-hero">
      <a class="back-link" href="/room-of-requirement/portraits">← Portraits</a>
      <div class="detail-identity">
        <div class="detail-photo" data-tier={contact.prestige_tier}>
          <span class="initials">
            {contact.full_name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div class="detail-meta">
          <h1>{contact.display_name ?? contact.full_name}</h1>
          {contact.title || contact.company ? (
            <p class="role">{contact.title}{contact.title && contact.company ? " · " : ""}{contact.company}</p>
          ) : null}
          <div class="badges">
            <span class="tier-badge">{tierNames[contact.prestige_tier]}</span>
            <span class="score">score {contact.tier_score}</span>
            {contact.is_placeholder === 1 && <span class="demo-ribbon">★ demo</span>}
          </div>
        </div>
      </div>
    </header>

    {contact.bio && <section class="section"><p class="bio">{contact.bio}</p></section>}

    <section class="section">
      <h2 class="section-title">Channels</h2>
      {contact.channels.length === 0 ? (
        <p class="muted">No channels recorded.</p>
      ) : (
        <ul class="channel-list">
          {contact.channels.map((ch) => (
            <li class="channel">
              <span class="channel-kind">{ch.kind}</span>
              <span class="channel-value">
                {ch.kind === "email" ? (
                  <a href={`mailto:${ch.value}`}>{ch.value}</a>
                ) : ch.kind === "phone" ? (
                  <a href={`tel:${ch.value.replace(/[^+\d]/g, "")}`}>{ch.value}</a>
                ) : ch.kind === "url" || ch.kind === "linkedin" || ch.kind === "twitter" || ch.kind === "x" || ch.kind === "facebook" ? (
                  <a href={ch.value} target="_blank" rel="noopener noreferrer">{ch.value}</a>
                ) : (
                  ch.value
                )}
              </span>
              {ch.label && <span class="channel-label">{ch.label}</span>}
              {ch.is_primary === 1 && <span class="primary-dot" title="primary">●</span>}
            </li>
          ))}
        </ul>
      )}
    </section>

    {tags.length > 0 && (
      <section class="section">
        <h2 class="section-title">Tags</h2>
        <div class="tags">
          {tags.map((t) => <span class="tag">{t}</span>)}
        </div>
      </section>
    )}

    <section class="section meta">
      <dl>
        <dt>Source</dt><dd>{contact.source}</dd>
        {contact.location && <><dt>Location</dt><dd>{contact.location}</dd></>}
        <dt>Added</dt><dd>{new Date(contact.created_at).toLocaleDateString()}</dd>
        <dt>Updated</dt><dd>{new Date(contact.updated_at).toLocaleDateString()}</dd>
      </dl>
    </section>
  </main>
</Base>

<style>
  .detail-page { max-width: 800px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
  .back-link { color: #8a877e; text-decoration: none; font-size: 0.875rem; }
  .back-link:hover { color: #d4a89a; }

  .detail-identity {
    display: flex; gap: 1.5rem; align-items: flex-start;
    margin-top: 1rem;
  }
  .detail-photo {
    width: 120px; height: 120px; border-radius: 4px;
    background: #1a1a1a; display: grid; place-items: center;
    border: 1px solid #2a2a2a; flex-shrink: 0;
  }
  .detail-photo[data-tier="S"] { border-color: #e7c76b; box-shadow: 0 0 12px rgba(231,199,107,0.2); }
  .detail-photo[data-tier="A"] { border-color: #c8cbd0; }
  .detail-photo[data-tier="B"] { border-color: #cd8a4e; }
  .initials {
    font-family: "Inter Tight", sans-serif; font-weight: 600;
    font-size: 1.75rem; color: #666;
  }
  .detail-meta h1 {
    font-family: "Inter Tight", sans-serif; font-weight: 500;
    font-size: clamp(1.5rem, 4vw, 2.25rem); margin: 0;
    color: #e8e6e0;
  }
  .role { color: #9a968c; margin: 0.25rem 0 0.5rem; }
  .badges { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .tier-badge {
    font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: #8a877e; border: 1px solid #3a3a3a; padding: 0.1rem 0.4rem; border-radius: 2px;
  }
  .score { font-size: 0.75rem; color: #6a665e; }
  .demo-ribbon { font-size: 0.75rem; color: #d4a89a; }

  .section { padding: 1.5rem 0; border-top: 1px solid #1a1a1a; margin-top: 1.5rem; }
  .section-title {
    font-family: "Inter Tight", sans-serif; font-weight: 500;
    font-size: 0.8125rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: #9a968c; margin: 0 0 0.75rem;
  }
  .bio { color: #bdb8ac; line-height: 1.6; margin: 0; }
  .muted { color: #6a665e; }

  .channel-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .channel { display: flex; gap: 0.75rem; align-items: baseline; font-size: 0.9375rem; }
  .channel-kind {
    width: 5rem; text-transform: uppercase; font-size: 0.6875rem;
    letter-spacing: 0.08em; color: #6a665e;
  }
  .channel-value a { color: #e8e6e0; text-decoration: none; border-bottom: 1px dashed #3a3a3a; }
  .channel-value a:hover { border-bottom-color: #d4a89a; color: #d4a89a; }
  .channel-label { font-size: 0.75rem; color: #6a665e; }
  .primary-dot { color: #d4a89a; font-size: 0.6rem; }

  .tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tag {
    font-size: 0.75rem; padding: 0.15rem 0.5rem;
    border: 1px solid #2a2a2a; border-radius: 2px; color: #9a968c;
  }

  .meta dl {
    display: grid; grid-template-columns: 6rem 1fr; gap: 0.35rem 1rem;
    font-size: 0.875rem;
  }
  .meta dt { color: #6a665e; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.06em; }
  .meta dd { color: #bdb8ac; margin: 0; }
</style>
```

- [ ] **Step 2: Smoke-test**

With dev server running, navigate to `http://localhost:4321/room-of-requirement/portraits/pp_01`.

Expected: Jensen's portrait-detail page with email `jensen@demo.portrait`, phone `+00 000 000 0001`, tier badge "Founder", demo ribbon, tags `founder, ai, semi`, source `manual`.

Navigate to a non-existent id: `http://localhost:4321/room-of-requirement/portraits/zzz`. Expected: 404.

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/portraits/[id].astro
git commit -m "feat(portraits): detail page — identity, channels, tags, meta"
```

---

## Task 17: Register route in sitemap + full smoke test

**Files:**
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Add the route entry**

Edit `src/data/site-routes.json`. In the `"static"` array, after the existing `/room-of-requirement/...` entries, insert:

```json
		{ "path": "/room-of-requirement/portraits", "title": "Portraits", "priority": "0.6" },
```

Place it after the line `{ "path": "/room-of-requirement/plugins", "title": "Plugins", "priority": "0.6" }` and before the Hogwarts entries.

- [ ] **Step 2: End-to-end smoke test**

Start dev server. Complete this checklist in order:

1. **Guest view**: open `/room-of-requirement/portraits` in a private/incognito window.
   - Banner visible: "🔒 Private collection. Showing a demo gallery..."
   - S-tier row has 4 gold-framed portraits (Jensen, Satya, Sundar, Vượng).
   - A-tier has 4 silver-framed (Lisa Su, Dario, Patrick, Bình).
   - B-tier has 4 bronze-framed (Karpathy, Lattner, Rauch, Hà Đông).
   - Each card has a `★ demo` ribbon.
   - No "＋ New portrait" button visible.

2. **Guest detail**: click Jensen's card.
   - URL `/portraits/pp_01`.
   - Shows "Founder" tier, email `jensen@demo.portrait`, phone `+00 000 000 0001`, bio about NVIDIA.
   - `mailto:` link on email works.

3. **Guest 404**: navigate to `/room-of-requirement/portraits/nonexistent`. Expected: 404 page.

4. **Admin login**: log in via `/_emdash/admin/login`. Navigate back to `/room-of-requirement/portraits`.
   - Banner gone.
   - Gallery now empty (admin default filters out placeholders; no real contacts yet).
   - "＋ New portrait" button visible.
   - Empty-state message: "No portraits yet. Add your first contact..."

5. **Admin add**: click "＋ New portrait". Fill:
   - Full name: "Real Contact"
   - Prestige tier: B
   - Primary email: "real@example.com"
   - Tags: `test, real`
   Submit. Expected: redirect to detail page.

6. **Admin detail**: detail page shows Real Contact, tier badge "Professor", channels, tags.

7. **Admin gallery**: navigate back to `/portraits`. Real Contact visible in "Professors" section, no demo ribbon.

8. **Admin 404**: `/room-of-requirement/portraits/pp_01` — returns a 404 page because admin view filters placeholders out. (This behavior is acceptable for Phase 1; an admin toggle to include placeholders is a Phase 5 task.)

9. **Mobile**: resize browser to 375px width. Gallery reflows, corridor table hides company column.

If all 9 steps pass, Phase 1 is functionally complete.

- [ ] **Step 3: Commit**

```bash
git add src/data/site-routes.json
git commit -m "feat(portraits): register gallery in sitemap + smoke test pass"
```

---

## Task 18: Clean up test contact and wrap up

**Files:** none

- [ ] **Step 1: Delete the test contact from D1**

Get the test contact's ID from step 5 above, then:

```bash
npx wrangler d1 execute pensieve-db --remote --command "UPDATE contacts SET deleted_at=datetime('now') WHERE full_name='Real Contact' AND is_placeholder=0"
```

Expected: `changes: 1`.

- [ ] **Step 2: Run the full test suite one last time**

```bash
npm test -- tests/portraits/
```

Expected: all tests pass (schema, auth, db, and the API smoke test skipped because `PORTRAITS_SMOKE_BASE_URL` is unset).

- [ ] **Step 3: Final verification from another tab**

Start dev server. Hit `/room-of-requirement/portraits` as guest: 12 portraits. As admin: empty.

Phase 1 done. Phases 2-5 (OCR, reminders, graph+outreach, integrations) each get their own plan authored after this ships.

---

## Deliberate deviations from the spec (Phase 1 only)

- **Detail view is a full page, not a slide-over.** The spec describes a right-side slide-over on desktop that drops to full-page on mobile. In Phase 1 the detail view ships as a full page on every viewport — a slide-over needs client-side React state that pays off most when we also have the Timeline / Notes / Relationships / Cards tabs (Phase 3-4). Re-adding it in Phase 3 is a single component swap; the URL structure (`/portraits/[id]`) is already correct.
- **Search and filter controls are not wired in the gallery header yet.** The spec shows search + tier chips + source chips + tag chips. The API supports `?q=` and `?tiers=` already; the gallery page doesn't render the controls. This lands cleanly in Phase 3 alongside the tag/reminder UI.
- **Tier-promotion quick menu on cards is omitted.** The spec has a "bump tier" menu on hover. Phase 1 edits go through the detail page; the quick menu lands in Phase 3.

All three omissions are UI polish, not capability — the underlying data and APIs from Phase 1 already support them.

## Notes for the implementer

- **Running dev server**: the server runs migrations and seeds at start; if you redo Task 1 after local `.wrangler/` changes, just rerun `npx wrangler d1 execute --local --file=scripts/portraits-001-schema.sql` to mirror into the local SQLite file.
- **Astro SSR + `cloudflare:workers`**: all API handlers and pages use `export const prerender = false`. Do not add `getStaticPaths()` anywhere in the portraits tree.
- **`link()` helper**: portraits live under `/room-of-requirement/`, not `/pensieve/`, so use absolute paths (`/room-of-requirement/portraits/...`) — do NOT use `link()` (it prepends `/pensieve/`).
- **D1 Astro.cache caveat**: the caching guide is in CLAUDE.md — every page that queries content MUST call `Astro.cache.set(cacheHint)`. Both page files do this already.
- **Role threshold**: `role >= 50` means admins only. If you ever want to let editors (role 40) in, the one-line change is in `src/lib/portraits/auth.ts`. Do NOT soften this without Loc's explicit OK.
- **ULIDs**: the inline ULID in `db.ts` is monotonic-within-process. Phase 2's card upload path benefits from lexically sortable IDs; don't swap for `crypto.randomUUID()`.
- **Placeholders**: the seed is idempotent (`INSERT OR REPLACE`); rerunning it is safe.
- **Security**: every mutation endpoint (`POST /api/portraits`, later `PATCH`, `DELETE`) MUST call `requireAdmin` first. The page-level gate on `/add` is a UX nicety, not a boundary.
