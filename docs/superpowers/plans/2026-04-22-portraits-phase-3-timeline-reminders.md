# Portraits — Phase 3: Interactions, Notes, Reminders

> Execute with superpowers:subagent-driven-development. Checkbox tasks.

**Goal:** Every contact gets a timeline (every meet/call/email logged), private markdown notes, and birthday/follow-up reminders. A daily Cloudflare cron computes upcoming reminders; the gallery shows a "⏰ 3 due this week" pill.

**Architecture:** Phase 1's migration already created `contact_notes`, `contact_interactions`, `contact_reminders` — Phase 3 just adds API routes + UI + the scheduled worker handler. Markdown sanitized with `marked` + `isomorphic-dompurify`. Reminders cron recomputes next birthday occurrence and inserts follow-up reminders for S/A-tier contacts with no interaction in 180 days.

**Spec:** `docs/superpowers/specs/2026-04-21-portraits-design.md`.

---

## File structure

```
src/lib/portraits/markdown.ts                -- renderMarkdown (marked + DOMPurify)
src/lib/portraits/reminders.ts               -- computeBirthdayReminders + computeFollowUps

src/pages/api/portraits/[id]/notes.ts              -- GET list, POST add
src/pages/api/portraits/[id]/interactions.ts       -- GET list, POST add
src/pages/api/portraits/reminders.ts               -- GET upcoming
src/pages/api/portraits/reminders/[id]/dismiss.ts  -- POST dismiss

src/components/portraits/Timeline.astro      -- reverse-chrono interaction list
src/components/portraits/NotesTab.astro      -- markdown notes with add form
src/components/portraits/RemindersPill.astro -- "⏰ N due this week" header widget

src/worker.ts                                -- add scheduled() handler

tests/portraits/reminders.test.ts
tests/portraits/markdown.test.ts
```

Modified:

```
package.json                                      -- add marked + isomorphic-dompurify
wrangler.jsonc                                    -- add [triggers] section with cron
src/pages/room-of-requirement/portraits/[id].astro  -- timeline + notes sections
src/pages/room-of-requirement/portraits/index.astro -- mount RemindersPill
```

---

## Task 1: Deps + markdown helper

**Files:** `package.json`, `src/lib/portraits/markdown.ts`, `tests/portraits/markdown.test.ts`

- [ ] **Step 1: Install deps**

```bash
bun add marked isomorphic-dompurify
```

- [ ] **Step 2: Test (TDD)**

`tests/portraits/markdown.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../../src/lib/portraits/markdown";

test("renderMarkdown: basic formatting", () => {
  const html = renderMarkdown("Hello **world**");
  assert.ok(html.includes("<strong>world</strong>"));
});

test("renderMarkdown: strips script tags", () => {
  const html = renderMarkdown("hi <script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
});

test("renderMarkdown: strips onclick handlers", () => {
  const html = renderMarkdown("[x](javascript:alert(1))");
  assert.ok(!html.includes("javascript:"));
});

test("renderMarkdown: empty input", () => {
  assert.equal(renderMarkdown(""), "");
});
```

- [ ] **Step 3: Impl**

`src/lib/portraits/markdown.ts`:

```ts
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(input: string): string {
  if (!input || !input.trim()) return "";
  const raw = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["p","br","strong","em","del","code","pre","ul","ol","li","blockquote","a","h1","h2","h3","h4","h5","h6","hr"],
    ALLOWED_ATTR: ["href","title"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock bun.lockb package-lock.json src/lib/portraits/markdown.ts tests/portraits/markdown.test.ts 2>/dev/null
git commit -m "feat(portraits): markdown renderer (marked + DOMPurify)"
```

With both co-author trailers via heredoc.

---

## Task 2: Reminder computation helpers

**Files:** `src/lib/portraits/reminders.ts`, `tests/portraits/reminders.test.ts`

- [ ] **Step 1: Test (TDD)**

`tests/portraits/reminders.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBirthdayOccurrence } from "../../src/lib/portraits/reminders";

test("nextBirthdayOccurrence: future same year", () => {
  // Today: 2026-04-22
  const d = nextBirthdayOccurrence("1990-08-15", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2026-08-15");
});

test("nextBirthdayOccurrence: past in current year → next year", () => {
  const d = nextBirthdayOccurrence("1990-02-10", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2027-02-10");
});

test("nextBirthdayOccurrence: year-less MM-DD format", () => {
  const d = nextBirthdayOccurrence("--05-20", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2026-05-20");
});

test("nextBirthdayOccurrence: returns null for invalid input", () => {
  assert.equal(nextBirthdayOccurrence("not-a-date", new Date()), null);
});
```

- [ ] **Step 2: Impl**

`src/lib/portraits/reminders.ts`:

```ts
// Compute the next future occurrence of a birthday (YYYY-MM-DD or --MM-DD format).
// Returns YYYY-MM-DD or null if the input is malformed.
export function nextBirthdayOccurrence(birthday: string, today: Date): string | null {
  let month: number, day: number;

  const fullMatch = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const shortMatch = birthday.match(/^--(\d{2})-(\d{2})$/);

  if (fullMatch) {
    month = parseInt(fullMatch[2], 10);
    day = parseInt(fullMatch[3], 10);
  } else if (shortMatch) {
    month = parseInt(shortMatch[1], 10);
    day = parseInt(shortMatch[2], 10);
  } else {
    return null;
  }

  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;

  const year = today.getUTCFullYear();
  const todayKey = today.toISOString().slice(0, 10);
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (candidate >= todayKey) return candidate;
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Helper for the cron. In a contact with birthday set, upsert a reminder at the next occurrence.
// Kept separate so the cron handler can call either without importing a D1 binding.
export interface BirthdayInput { contact_id: string; birthday: string; full_name: string }

export interface UpcomingReminder {
  id: string;
  contact_id: string;
  kind: string;
  due_at: string;
  body: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/portraits/reminders.ts tests/portraits/reminders.test.ts
git commit -m "feat(portraits): reminder computation helpers (birthday next-occurrence)"
```

---

## Task 3: Notes API

**Files:** `src/pages/api/portraits/[id]/notes.ts`

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT id, body, created_at, updated_at FROM contact_notes WHERE contact_id=? ORDER BY created_at DESC")
    .bind(id)
    .all();
  return json({ notes: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: { body?: string };
  try { body = await ctx.request.json() as { body?: string }; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (typeof body.body !== "string" || !body.body.trim()) return json({ error: "body_required" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_notes (id, contact_id, body, created_at, updated_at) VALUES (?,?,?,?,?)`)
    .bind(id, contact_id, body.body.trim(), now, now)
    .run();
  return json({ note: { id, contact_id, body: body.body.trim(), created_at: now, updated_at: now } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "", t = now;
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  let rs = "", bits = 0, acc = 0;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | rand[i]; bits += 8;
    while (bits >= 5) { bits -= 5; rs += CROCKFORD[(acc >> bits) & 31]; }
  }
  return time + rs;
}
```

Commit: `git add src/pages/api/portraits/\[id\]/notes.ts && git commit -m "feat(portraits): GET/POST /api/portraits/:id/notes"`

---

## Task 4: Interactions API

**Files:** `src/pages/api/portraits/[id]/interactions.ts`

Near-identical structure to notes, with fields `kind`/`body`/`happened_at`/`metadata`:

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

const KINDS = ["met", "call", "email_sent", "email_received", "note", "deal", "intro"] as const;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT id, kind, body, happened_at, metadata, created_at FROM contact_interactions WHERE contact_id=? ORDER BY happened_at DESC")
    .bind(id)
    .all();
  return json({ interactions: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const contact_id = ctx.params.id;
  if (typeof contact_id !== "string" || !contact_id) return json({ error: "missing_id" }, 400);

  let body: { kind?: string; body?: string; happened_at?: string; metadata?: unknown };
  try { body = await ctx.request.json() as any; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (!KINDS.includes(body.kind as any)) return json({ error: "invalid_kind", allowed: KINDS }, 400);
  if (body.body !== undefined && typeof body.body !== "string") return json({ error: "body_must_be_string" }, 400);
  const happened_at = typeof body.happened_at === "string" ? body.happened_at : new Date().toISOString();

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_interactions (id, contact_id, kind, body, happened_at, metadata, created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(
      id, contact_id, body.kind, body.body ?? null, happened_at,
      body.metadata !== undefined ? JSON.stringify(body.metadata) : null, now,
    )
    .run();
  return json({ interaction: { id, contact_id, kind: body.kind, body: body.body ?? null, happened_at, metadata: body.metadata ?? null, created_at: now } }, 201);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "", t = now;
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  let rs = "", bits = 0, acc = 0;
  for (let i = 0; i < 10; i++) { acc = (acc << 8) | rand[i]; bits += 8; while (bits >= 5) { bits -= 5; rs += CROCKFORD[(acc >> bits) & 31]; } }
  return time + rs;
}
```

Commit: `git add src/pages/api/portraits/\[id\]/interactions.ts && git commit -m "feat(portraits): GET/POST /api/portraits/:id/interactions"`

---

## Task 5: Reminders API

**Files:** `src/pages/api/portraits/reminders.ts`, `src/pages/api/portraits/reminders/[id]/dismiss.ts`

`src/pages/api/portraits/reminders.ts`:

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../lib/portraits/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "7", 10), 1), 90);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86400 * 1000).toISOString().slice(0, 10);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare(`
      SELECT r.id, r.contact_id, r.kind, r.due_at, r.body, c.full_name, c.prestige_tier
      FROM contact_reminders r
      JOIN contacts c ON c.id = r.contact_id
      WHERE r.dismissed_at IS NULL
        AND date(r.due_at) <= date(?)
        AND c.deleted_at IS NULL
      ORDER BY r.due_at ASC
      LIMIT 50
    `)
    .bind(horizon)
    .all();
  return json({ reminders: rs.results ?? [] });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
```

`src/pages/api/portraits/reminders/[id]/dismiss.ts`:

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);
  const id = ctx.params.id;
  if (typeof id !== "string" || !id) return json({ error: "missing_id" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const now = new Date().toISOString();
  const res = await db.prepare("UPDATE contact_reminders SET dismissed_at=? WHERE id=? AND dismissed_at IS NULL").bind(now, id).run();
  if (res.meta.changes === 0) return json({ error: "not_found_or_dismissed" }, 404);
  return json({ ok: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
```

Commit: `git add src/pages/api/portraits/reminders.ts 'src/pages/api/portraits/reminders/[id]/dismiss.ts' && git commit -m "feat(portraits): reminders API (GET upcoming + POST dismiss)"`

---

## Task 6: Cron scheduled handler

**Files:** `src/worker.ts`, `wrangler.jsonc`

- [ ] **Step 1: Wrangler cron trigger**

Edit `wrangler.jsonc` — add a `"triggers"` block at the top level:

```jsonc
	"triggers": {
		"crons": ["0 23 * * *"]
	},
```

Place it after the `"routes"` array and before `"d1_databases"`.

- [ ] **Step 2: Scheduled handler**

Edit `src/worker.ts`. Import the reminder computation and add a `scheduled` handler alongside `fetch`. Find the `export default { async fetch(...) { ... } }` block and replace with an extended version including `scheduled`:

```ts
	async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
		// Runs daily at 23:00 UTC = 06:00 Asia/Ho_Chi_Minh.
		// Recompute upcoming birthday reminders + insert follow-up reminders.
		const db = env.DB;
		if (!db) return;

		const today = new Date();
		const todayKey = today.toISOString().slice(0, 10);

		// 1. Birthday reminders: upsert for next occurrence of each contact's birthday.
		const contactsWithBirthday = await db
			.prepare("SELECT id, birthday FROM contacts WHERE birthday IS NOT NULL AND deleted_at IS NULL AND is_placeholder=0")
			.all<{ id: string; birthday: string }>();
		for (const c of contactsWithBirthday.results ?? []) {
			const next = nextBirthdayOccurrence(c.birthday, today);
			if (!next) continue;
			// delete any existing active birthday reminder for this contact, re-insert
			await db.prepare("DELETE FROM contact_reminders WHERE contact_id=? AND kind='birthday' AND dismissed_at IS NULL").bind(c.id).run();
			await db
				.prepare("INSERT INTO contact_reminders (id, contact_id, kind, due_at, recurring, body, created_at) VALUES (?,?,?,?,?,?,?)")
				.bind(ulid(), c.id, "birthday", next, "yearly", null, today.toISOString())
				.run();
		}

		// 2. Follow-up reminders: S/A-tier contacts with no interaction in 180 days.
		const stale = await db
			.prepare(`
				SELECT c.id
				FROM contacts c
				LEFT JOIN contact_interactions i ON i.contact_id = c.id
				WHERE c.deleted_at IS NULL
					AND c.is_placeholder = 0
					AND c.prestige_tier IN ('S','A')
				GROUP BY c.id
				HAVING COALESCE(MAX(i.happened_at), '1970-01-01') < date('now', '-180 days')
			`)
			.all<{ id: string }>();
		for (const c of stale.results ?? []) {
			// Only insert if not already pending
			const existing = await db.prepare("SELECT 1 FROM contact_reminders WHERE contact_id=? AND kind='follow_up' AND dismissed_at IS NULL").bind(c.id).first();
			if (existing) continue;
			await db
				.prepare("INSERT INTO contact_reminders (id, contact_id, kind, due_at, body, created_at) VALUES (?,?,?,?,?,?)")
				.bind(ulid(), c.id, "follow_up", todayKey, "Last contact > 6mo", today.toISOString())
				.run();
		}
	},
```

Add the helpers at the top of the file (below the existing imports):

```ts
import { nextBirthdayOccurrence } from "./lib/portraits/reminders";

function ulid(): string {
	const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
	const now = Date.now();
	const rand = crypto.getRandomValues(new Uint8Array(10));
	let time = "", t = now;
	for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
	let rs = "", bits = 0, acc = 0;
	for (let i = 0; i < 10; i++) { acc = (acc << 8) | rand[i]; bits += 8; while (bits >= 5) { bits -= 5; rs += CROCKFORD[(acc >> bits) & 31]; } }
	return time + rs;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/worker.ts wrangler.jsonc
git commit -m "feat(portraits): daily cron — birthday + follow-up reminders"
```

---

## Task 7: RemindersPill gallery widget

**Files:** `src/components/portraits/RemindersPill.astro`

```astro
---
import type { D1Database } from "@cloudflare/workers-types";

interface Props { db: D1Database }
const { db } = Astro.props;

interface Row { n: number }
const rs = await db
  .prepare("SELECT COUNT(*) AS n FROM contact_reminders WHERE dismissed_at IS NULL AND date(due_at) <= date('now', '+7 days')")
  .first<Row>();
const count = rs?.n ?? 0;
---

{count > 0 && (
  <a class="reminders-pill" href="#reminders-slideover" data-count={count}>
    ⏰ {count} {count === 1 ? "reminder" : "reminders"} due this week
  </a>
)}

<style>
  .reminders-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: #d4a89a;
    background: rgba(212, 168, 154, 0.08);
    border: 1px solid #d4a89a44;
    padding: 0.3rem 0.65rem;
    border-radius: 2px;
    text-decoration: none;
    transition: background 120ms ease;
  }
  .reminders-pill:hover { background: rgba(212, 168, 154, 0.14); }
</style>
```

Then add to `src/pages/room-of-requirement/portraits/index.astro`, inside `.portraits-hero` after the admin-actions block:

```astro
{auth.admin && <RemindersPill db={db} />}
```

Commit: `git add src/components/portraits/RemindersPill.astro src/pages/room-of-requirement/portraits/index.astro && git commit -m "feat(portraits): RemindersPill widget in gallery header"`

---

## Task 8: Timeline + Notes on detail page

**Files:** `src/pages/room-of-requirement/portraits/[id].astro`, `src/components/portraits/Timeline.astro`, `src/components/portraits/NotesTab.astro`

`src/components/portraits/Timeline.astro`:

```astro
---
import type { D1Database } from "@cloudflare/workers-types";

interface Props { db: D1Database; contactId: string }
const { db, contactId } = Astro.props;

interface InteractionRow { id: string; kind: string; body: string | null; happened_at: string }
const rs = await db
  .prepare("SELECT id, kind, body, happened_at FROM contact_interactions WHERE contact_id=? ORDER BY happened_at DESC LIMIT 50")
  .bind(contactId)
  .all<InteractionRow>();
const rows = (rs.results ?? []) as InteractionRow[];

const kindIcon = {
  met: "🤝",
  call: "📞",
  email_sent: "📤",
  email_received: "📥",
  note: "📝",
  deal: "💼",
  intro: "🫱",
} as const;
function icon(k: string): string {
  return (kindIcon as Record<string, string>)[k] ?? "•";
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
---

<section class="section timeline">
  <h2 class="section-title">Timeline</h2>
  {rows.length === 0 ? (
    <p class="muted">No interactions logged yet.</p>
  ) : (
    <ul class="timeline-list">
      {rows.map((r) => (
        <li class="timeline-item">
          <span class="icon">{icon(r.kind)}</span>
          <div class="body">
            <div class="meta"><strong>{r.kind.replace("_", " ")}</strong> · {fmt(r.happened_at)}</div>
            {r.body && <div class="note">{r.body}</div>}
          </div>
        </li>
      ))}
    </ul>
  )}

  <form id="log-form" class="log-form">
    <select name="kind" required>
      <option value="met">met</option>
      <option value="call">call</option>
      <option value="email_sent">email sent</option>
      <option value="email_received">email received</option>
      <option value="deal">deal</option>
      <option value="intro">intro</option>
    </select>
    <input type="text" name="body" placeholder="Short note (optional)" maxlength="500" />
    <button type="submit">＋ log</button>
  </form>
</section>

<script define:vars={{ contactId }}>
  const form = document.getElementById("log-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      kind: String(fd.get("kind") ?? ""),
      body: String(fd.get("body") ?? "").trim() || undefined,
      happened_at: new Date().toISOString(),
    };
    const res = await fetch(`/api/portraits/${contactId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) window.location.reload();
  });
</script>

<style>
  .timeline-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .timeline-item { display: flex; gap: 0.75rem; }
  .icon { font-size: 1.1rem; line-height: 1.2; padding-top: 0.1rem; }
  .meta { color: #8a877e; font-size: 0.8125rem; }
  .meta strong { color: #bdb8ac; font-weight: 500; }
  .note { color: #bdb8ac; font-size: 0.9rem; margin-top: 0.15rem; }
  .muted { color: #6a665e; margin-bottom: 1rem; }
  .log-form { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .log-form select, .log-form input { background: #111; border: 1px solid #2a2a2a; color: #e8e6e0; padding: 0.4rem 0.6rem; border-radius: 3px; font: inherit; }
  .log-form input { flex: 1; min-width: 180px; }
  .log-form button { background: transparent; border: 1px solid #d4a89a; color: #d4a89a; padding: 0.4rem 0.9rem; border-radius: 3px; cursor: pointer; font: inherit; }
  .log-form button:hover { background: rgba(212, 168, 154, 0.08); }
</style>
```

`src/components/portraits/NotesTab.astro`:

```astro
---
import type { D1Database } from "@cloudflare/workers-types";
import { renderMarkdown } from "../../lib/portraits/markdown";

interface Props { db: D1Database; contactId: string }
const { db, contactId } = Astro.props;

interface NoteRow { id: string; body: string; created_at: string; updated_at: string }
const rs = await db
  .prepare("SELECT id, body, created_at, updated_at FROM contact_notes WHERE contact_id=? ORDER BY created_at DESC")
  .bind(contactId)
  .all<NoteRow>();
const rows = (rs.results ?? []) as NoteRow[];
---

<section class="section notes">
  <h2 class="section-title">Notes</h2>
  {rows.length === 0 ? <p class="muted">No notes yet.</p> : (
    <ul class="notes-list">
      {rows.map((n) => (
        <li class="note">
          <div class="note-meta">{new Date(n.created_at).toLocaleDateString()}</div>
          <div class="note-body" set:html={renderMarkdown(n.body)} />
        </li>
      ))}
    </ul>
  )}

  <form id="note-form" class="note-form">
    <textarea name="body" rows="3" placeholder="Markdown OK" required maxlength="4000"></textarea>
    <button type="submit">＋ add note</button>
  </form>
</section>

<script define:vars={{ contactId }}>
  const form = document.getElementById("note-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const res = await fetch(`/api/portraits/${contactId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: String(fd.get("body") ?? "").trim() }),
    });
    if (res.ok) window.location.reload();
  });
</script>

<style>
  .notes-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .note { padding: 0.75rem; border: 1px solid #2a2a2a; border-radius: 3px; }
  .note-meta { color: #6a665e; font-size: 0.75rem; letter-spacing: 0.04em; margin-bottom: 0.35rem; }
  .note-body { color: #bdb8ac; line-height: 1.55; }
  .note-body :global(p) { margin: 0.25rem 0; }
  .note-body :global(strong) { color: #e8e6e0; }
  .note-body :global(code) { background: #1a1a1a; padding: 0.1rem 0.3rem; border-radius: 2px; }
  .note-form { display: flex; flex-direction: column; gap: 0.5rem; }
  .note-form textarea { background: #111; border: 1px solid #2a2a2a; color: #e8e6e0; padding: 0.5rem 0.7rem; border-radius: 3px; font: inherit; resize: vertical; }
  .note-form button { align-self: flex-start; background: transparent; border: 1px solid #d4a89a; color: #d4a89a; padding: 0.4rem 0.9rem; border-radius: 3px; cursor: pointer; font: inherit; }
  .note-form button:hover { background: rgba(212, 168, 154, 0.08); }
</style>
```

Add to `src/pages/room-of-requirement/portraits/[id].astro`. Import at top:

```ts
import Timeline from "../../../components/portraits/Timeline.astro";
import NotesTab from "../../../components/portraits/NotesTab.astro";
```

Then in the main body, AFTER the Tags section `</section>` and BEFORE the Cards section (admin-only), insert:

```astro
{auth.admin && <Timeline db={db} contactId={contact.id} />}
{auth.admin && <NotesTab db={db} contactId={contact.id} />}
```

Commit: `git add src/components/portraits/Timeline.astro src/components/portraits/NotesTab.astro 'src/pages/room-of-requirement/portraits/[id].astro' && git commit -m "feat(portraits): Timeline + Notes tabs on detail page"`

---

## Task 9: Smoke test + Phase 3 tag

```bash
npm test -- tests/portraits/markdown.test.ts tests/portraits/reminders.test.ts
npx astro check 2>&1 | grep -c "src/(components|pages)/(portraits|room-of-requirement/portraits|api/portraits)"
```

Expect: tests pass, 0 new errors.

```bash
git commit --allow-empty -m "chore(portraits): Phase 3 complete — timeline + notes + reminders"
```

Include co-author trailers.

---

## Deferrals

- Markdown live preview (Phase 4 if demand)
- Per-contact reminder UI beyond the gallery pill (Phase 4)
- Email digest via Resend (Phase 4 alongside outreach compose)
