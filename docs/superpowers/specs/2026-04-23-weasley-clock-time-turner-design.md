# The Weasley Clock + The Time-Turner — calendar + booking platform

**Date:** 2026-04-23
**Surfaces:** `/hogwarts/weasley-clock` (family dashboard), `/hogwarts/time-turner/{audience}` (booking), plugin admin at `/_emdash/admin/weasley-clock/*`
**Status:** Design approved by user; implementation plan to follow
**Origin request:** "implement cal.diy on my site, this is to be my personal calendar and family calendar"

## Why

Loc needs one surface that holds every calendar-shaped thing in his life — family anniversaries (including giỗ on lunar dates), work calendars from multiple companies, flight itineraries, and a public booking face for partners / personal assistants / OpenClaw contacts — with Tam (`tam@huuloc.com`) as a co-editor for household content. Today this data is scattered across 4–6 Google calendars, Facebook birthday reminders, and TripIt-like habits, with no shared family view and no public booking page.

The user asked for Cal.com (`calcom/cal.diy`) as the reference. Cal.com is a Next.js/Postgres/Prisma/tRPC monolith designed for multi-tenant SaaS; it can't be forked onto Cloudflare Workers + D1 + Astro. So the goal is to **build the same behaviour Cal.com provides plus five more subsystems Cal.com doesn't cover, all native to this stack**.

## Scope

Six subsystems in one design:

1. **Sync-in** — aggregate read-only events from multiple external calendars (work, private, airline ICS feeds).
2. **Curated-in** — hand-entered family events: birthdays, giỗ, wedding anniversaries, Tết, Vu Lan, and similar cultural observances, with Vietnamese lunar-calendar support.
3. **Booking-in** — public booking pages scoped per audience (partners, PAs, OpenClaw), with meeting types, buffers, notice, and advance caps.
4. **Fulfillment-out** — send `.ics` confirmations to guests and Loc on booking; publish a private subscribed ICS feed so bookings appear in Loc's Google Calendar automatically.
5. **Family view** — one dashboard (`/hogwarts/weasley-clock`) showing all of it, with every date rendered in both Gregorian (dương lịch) and Vietnamese lunar (âm lịch).
6. **Shared household** — Tam edits family events and meeting types via EmDash admin; Tam does not have her own sync or booking face.

### Non-goals (explicit)

- **No two-way sync.** The system reads ICS feeds but never writes back to Google/Outlook/iCloud. Loc subscribes to our private ICS from Google to close the loop.
- **No per-user sync or per-user booking** for Tam. She is a co-admin of family data, not a second bookable identity.
- **No SMS/push notifications.** Email only, via existing `resend` plugin.
- **No CAPTCHA initially.** Turnstile is on the shortlist if spam shows up.
- **No dedicated flight schema.** Flights arrive as ICS events (Google Smart-parse → work Google Cal → our ICS pipeline); we recognise them by title pattern at render time.
- **No Google/Microsoft OAuth.** ICS-only. This is a conscious scope reduction — OAuth is roughly 5× the implementation cost and unlocks two-way sync we've chosen not to need.

## Locked decisions

Six user-chosen answers form the architectural spine.

| # | Question | Choice |
|---|----------|--------|
| 1 | Role of `tam@huuloc.com` | Shared admin on one household calendar (no per-user sync/booking) |
| 2 | External calendar ingest | ICS feeds only, Cloudflare cron-driven |
| 3 | Booking page shape | Audience-scoped pages with shared meeting-type catalog |
| 4 | Lunar calendar handling | Per-event canonical calendar flag (solar/lunar); every UI renders **both** dates |
| 5 | Site placement | Split doors, shared engine — Weasley Clock (family) + Time-Turner (booking) |
| 6 | Booking fulfillment | Email `.ics` (fast path) + private subscribed ICS feed (backstop) — both |

One architectural-pattern decision:

| # | Question | Choice |
|---|----------|--------|
| P | How to build within the site | Hybrid — EmDash collections for human-curated data; plugin-owned D1 tables for machine-written data |

## Architecture

```
                             WEASLEY CLOCK ENGINE
                          (plugin-weasley-clock + D1)
                                     │
    ┌────────────────┬───────────────┼───────────────┬────────────────┐
    │                │               │               │                │
SYNC IN        CURATED IN       BOOKING IN     FULFILLMENT OUT    SYNC OUT
    │                │               │               │                │
Cron every      EmDash collections  Guest books    Resend sends     Private ICS
~10 min         (loc + tam edit)    via            guest .ics       feed URL
fetches N ICS   • family_events     /hogwarts/     + loc .ics       /hogwarts/
URLs, upserts   • meeting_types     time-turner/                    weasley-clock/
into                                {audience}                      private/
synced_events                                                       <secret>.ics
    │                 │               │               │                │
    └────────────────┴───────────────┴───────────────┴────────────────┘
                                     │
                           FREE/BUSY COMPUTER
                 (merges synced_events + materialised family_events
                  + bookings → "is loc busy from T1 to T2?")
                                     │
                    ┌────────────────┴──────────────────┐
                    │                                   │
            WEASLEY CLOCK SURFACE           TIME-TURNER SURFACES
            /hogwarts/weasley-clock          /hogwarts/time-turner/partners
            (family dashboard,                /hogwarts/time-turner/assistants
             dual-calendar grid,              /hogwarts/time-turner/openclaw
             D/W/M/Y views,                   (audience-filtered slots,
             click→popover,                   book-a-slot UI,
             today auto-grows)                mix of fast + themed styling)
```

### Plugin components (five)

1. **ICS parser + cron** — `scheduled` handler runs every 10 min, iterates active `ics_sources`, fetches, diffs, upserts into `synced_events`. Emails Loc after 3 consecutive failures on a source.
2. **Free/busy computer** — pure function `isBusy(range, ctx) → BlockedInterval[]`. Queries three sources: active `synced_events`, materialised family events (via lunar conversion), confirmed `bookings`. Respects meeting-type buffers.
3. **Booking API** — `POST /api/time-turner/book` validates payload, runs free/busy recheck in a D1 transaction, inserts `bookings`, triggers resend emails (guest + Loc), returns confirmation.
4. **Private ICS endpoint** — `GET /hogwarts/weasley-clock/private/<secret>.ics` — VCALENDAR serialisation of `bookings` + materialised family_events. Secret IS the auth; rate-limited per IP.
5. **Lunar conversion module** — `solarToLunar(date) / lunarToSolar({ month, day, year, isLeap })` via Hồ Ngọc Đức's tables. Vendored (~2KB of data + ~300 lines logic). Pure, deterministic, no network.

### Data flow — booking hot path

```
Guest → /hogwarts/time-turner/partners
      → Astro renders available slots (free/busy next 30 days)
      → Guest picks slot, fills form
      → POST /api/time-turner/book { meeting_type, starts_at, ends_at, guest... }
      → Rate-limit check (booking_attempts)
      → D1 atomic batch:
          ├─ SELECT free/busy for exact range (all three sources)
          ├─ If busy: return 409 "slot taken" (no writes)
          └─ Else: INSERT bookings row with cancellation_token_hash in same batch
          (D1 batches are atomic — either all statements commit or none do.
          Race-safety comes from the SELECT-then-INSERT being in the same batch,
          plus a uniqueness check on (starts_at, ends_at, status='confirmed'))
      → Post-commit async:
          ├─ Resend to guest: confirmation with .ics attachment + cancel link
          └─ Resend to loc.truongh@gmail.com: "new booking" summary
      → Within 24h: Google Calendar polls our private ICS → booking shows in Loc's work cal
```

### Data flow — sync cron

```
Cloudflare Cron (every 10 min)
  → For each ics_sources WHERE active=1:
      ├─ Fetch ics_url (10s timeout)
      ├─ On HTTP error → increment fail counter; if ≥3, email loc
      ├─ Parse VCALENDAR (ical.js or similar, UTF-8 safe)
      ├─ Upsert each VEVENT into synced_events by (source_id, external_uid)
      │     ├─ New: INSERT
      │     ├─ Changed: UPDATE + set synced_at
      │     └─ Missing from feed: UPDATE deleted=1 (soft-delete)
      └─ UPDATE ics_sources SET last_synced_at=now(), last_sync_status='ok'
```

## Data model

### EmDash collections (human-curated, low-volume)

#### `family_events`

| Field | Type | Notes |
|-------|------|-------|
| `title` | bilingual `{ en, vi }` | e.g. `{ en: "Grandfather's giỗ", vi: "Giỗ Ông Nội" }` |
| `event_type` | enum | `birthday | death_anniv | wedding_anniv | cultural | milestone` |
| `date_calendar` | enum | `solar | lunar` |
| `month` | int (1–12) | |
| `day` | int (1–31) | |
| `is_leap_month` | bool | Only meaningful for `lunar` origin year. Subsequent years observe on regular month. |
| `origin_year` | int? | birth year / death year / wedding year — drives "72nd birthday" / "7th giỗ" labels |
| `person_name` | string? | Free-text. `"Ông Nội Trương Văn Hương"` |
| `relationship` | string? | Free-text. `"grandfather (paternal)"` |
| `notes` | portable-text (bilingual) | Traditions, dishes, people to call, photos |
| `visibility` | enum | `household` (default) \| `public` — public variants appear on a future site-wide surface |
| `reminder_days_before` | int[] | JSON array. Default `[7, 1]` — emails sent 7 days and 1 day before. Per-event override, e.g. `[14, 3]`. |
| `photo` | image? `{ src, alt }` | Optional |

#### `meeting_types`

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | `"partner-intro"`, `"pa-15"`, `"openclaw-review"` |
| `title` | bilingual `{ en, vi }` | |
| `description` | portable-text (bilingual) | |
| `duration_min` | int | 15, 30, 45, 60, 90 |
| `audience_tags` | multi-select | `[partners, assistants, openclaw]` — drives which `/time-turner/<audience>` pages it appears on |
| `availability_id` | ref → `availability_rules` | Which weekly schedule applies |
| `buffer_before` | int (min) | Blocked before each booking |
| `buffer_after` | int (min) | Blocked after each booking |
| `min_notice_hrs` | int | Default 24 |
| `max_advance_days` | int | Default 30 |
| `questions` | array of `{ key, label, type, required }` | Custom intake form fields |
| `color` | hex | For UI tint |

### Plugin-owned D1 tables (machine-written)

```sql
CREATE TABLE ics_sources (
  id                     TEXT PRIMARY KEY,              -- ULID
  label                  TEXT NOT NULL,                 -- "Loc · VNG Work"
  ics_url                TEXT NOT NULL,                 -- secret iCal URL from provider
  color                  TEXT,                          -- hex
  category               TEXT,                          -- work | personal | family | travel
  sync_frequency_minutes INTEGER NOT NULL DEFAULT 10,
  last_synced_at         TEXT,
  last_sync_status       TEXT,                          -- 'ok' | 'error'
  last_sync_error        TEXT,
  consecutive_failures   INTEGER NOT NULL DEFAULT 0,  -- reset to 0 on any successful sync; incremented on each failure

  active                 INTEGER NOT NULL DEFAULT 1,
  expose_titles          INTEGER NOT NULL DEFAULT 0,    -- 0 = free/busy only in UI, 1 = show titles
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE synced_events (
  id            TEXT PRIMARY KEY,                       -- ULID
  source_id     TEXT NOT NULL REFERENCES ics_sources(id) ON DELETE CASCADE,
  external_uid  TEXT NOT NULL,                          -- ICS UID
  title         TEXT,
  starts_at     TEXT NOT NULL,                          -- ISO 8601 UTC
  ends_at       TEXT NOT NULL,
  all_day       INTEGER NOT NULL DEFAULT 0,
  location      TEXT,
  description   TEXT,
  raw_ics       TEXT,                                    -- original VEVENT block, for debugging
  deleted       INTEGER NOT NULL DEFAULT 0,             -- soft-delete
  synced_at     TEXT NOT NULL,
  UNIQUE (source_id, external_uid)
);
CREATE INDEX idx_synced_events_time ON synced_events(starts_at, ends_at) WHERE deleted = 0;

CREATE TABLE availability_rules (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,                        -- "Partner hours", "PA hours", "OpenClaw hours"
  timezone        TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  weekly_schedule TEXT NOT NULL,                        -- JSON: { "mon": [{"start":"09:00","end":"12:00"}, ...], ... }
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE bookings (
  id                           TEXT PRIMARY KEY,       -- ULID
  meeting_type_slug            TEXT NOT NULL,
  audience                     TEXT NOT NULL,          -- 'partners' | 'assistants' | 'openclaw'
  guest_name                   TEXT NOT NULL,
  guest_email                  TEXT NOT NULL,
  starts_at                    TEXT NOT NULL,          -- UTC
  ends_at                      TEXT NOT NULL,
  timezone                     TEXT NOT NULL,          -- guest's TZ, for email rendering
  custom_answers               TEXT,                   -- JSON, keyed by meeting_type.questions[].key
  status                       TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | cancelled | completed
  cancellation_token_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 of secret; secret never stored raw
  confirmation_email_sent_at   TEXT,
  owner_email_sent_at          TEXT,
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL
);
CREATE INDEX idx_bookings_time ON bookings(starts_at, ends_at) WHERE status = 'confirmed';

CREATE TABLE booking_attempts (
  id           TEXT PRIMARY KEY,
  ip_hash      TEXT NOT NULL,                          -- SHA-256 of IP (privacy)
  email_hash   TEXT NOT NULL,                          -- SHA-256 of lowercased email
  attempted_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_recent ON booking_attempts(attempted_at);
-- Cron cleans rows older than 24h

CREATE TABLE private_feeds (
  id                TEXT PRIMARY KEY,
  secret            TEXT NOT NULL UNIQUE,              -- 32-char base32
  label             TEXT NOT NULL,
  include_family    INTEGER NOT NULL DEFAULT 1,
  include_bookings  INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  revoked_at        TEXT
);
```

### Recurrence materialisation

**Solar events:** recur on `(month, day)` each year. Feb-29 births fall back to Feb 28 in non-leap years (documented convention).

**Lunar events:** for year Y, compute Gregorian date via `lunarToSolar({ month, day, year: Y })`. The `is_leap_month` flag only matters for the origin-year record — in any year Y that also has a leap-month-N, we observe on the regular month-N, per Vietnamese convention.

**No precomputed occurrences table.** Given ~50 family events × ~365 days of lookahead, materialisation is ~50 function calls per page render — cheap enough to run live. Revisit only if event volume crosses ~1,000.

### Flights — no dedicated schema

Flights arrive via Google Smart-parse in Loc's work Google Cal → ICS feed → `synced_events`. At render time, titles matching IATA flight-code patterns (`/^[A-Z]{2}\s?\d{2,4}\b/`: SQ186, VN255, BL6020, etc.) get a ✈ icon and the "Flight" category tint (`#a67a3e`). Best-effort — misses 3-letter ICAO codes, but those almost never appear in consumer booking confirmations. Pure presentational logic; no new storage.

## UI surfaces

### Weasley Clock — family dashboard (`/hogwarts/weasley-clock`)

**Skeleton:** grid-first, agenda-in-cells. No separate agenda list.

**Header bar (sticky):**
- Left: small Weasley Clock artifact + today's family status line ("LOC · WORK · TAM · HOME")
- Centre: `← APR 2026 →` range nav + `TODAY` button
- Right: segmented D/W/M/Y view switcher. Keyboard shortcuts: `1`/`d` = day, `2`/`w` = week, `3`/`m` = month, `4`/`y` = year, `t` = today, `/` = search.

**Week view (default):** 7 day columns, each tall enough to show 4–6 events as colored bars with inline title + meta. Today column is outlined in brass. Sunday column gets a brass tint (the red-Sunday convention of Vietnamese desk calendars).

**Month view:** 7 × 5–6 grid with compressed event chips (short titles, never bare dots). **The row containing today auto-grows** to full week-view fidelity; all other rows use compressed height. Click any cell → popover with full detail for that day. Lunar-month boundary labelled on the cell where it changes (e.g. `tháng 3` appears on 17 Apr 2026).

**Year view:** 12 mini-months laid out as 4 columns × 3 rows. Each cell within a mini-month is a day; colour intensity = event count, tint = dominant category. Click a cell → jump to that day.

**Day view:** hourly column 06:00–23:00 with synced events as timed blocks, all-day family events pinned to the top. Dual-calendar date in the column header.

**Every surface renders both dương lịch and âm lịch.** Big Gregorian numeral + small âm lịch (`6/3`) under or beside it. Lunar new-month labels (`tháng 3`, `tháng 4 nhuận`) shown on the first cell of a new lunar month.

### Time-Turner — booking surfaces (`/hogwarts/time-turner/{audience}`)

Three audience routes: `/partners`, `/assistants`, `/openclaw`. Styling **mixes** by audience:

- **`/partners` and `/openclaw`** use Layout A — **cal.com-style**: two-column picker (date + time slots), compact meeting-type cards, form inline. Brass accents + themed copy on a familiar pattern; optimises for professional first-time visitors who book-and-go.
- **`/assistants`** uses Layout B — **The Turn**: hourglass SVG hero, narrative copy, flowing vertical layout. Slower, more memorable; appropriate for a closer-circle audience where brand whimsy is on-brand.

All three share the same D1 tables, free/busy computer, availability rules, and meeting-type catalog. Audience filtering happens via the `audience_tags` multi-select on `meeting_types`.

**Confirmation flow** (both layouts):
1. Guest picks meeting type → date → slot.
2. Form fields: name, email, company, plus any `meeting_type.questions` custom fields.
3. Submit → `POST /api/time-turner/book`.
4. Success page: "Your turn is set. Confirmation on its way to <email>." — with the dual-calendar date, slot time in guest's auto-detected TZ, and a button "Turn another".
5. Emails land via resend: guest gets confirmation + .ics + cancel link; Loc gets a brief "new booking" digest.

### Admin surfaces

- **`/_emdash/admin/collections/family-events`** — EmDash-generated admin for `family_events`. Tam + Loc.
- **`/_emdash/admin/collections/meeting-types`** — EmDash-generated admin for `meeting_types`. Tam + Loc.
- **`/_emdash/admin/weasley-clock/feeds`** — plugin page listing `ics_sources`; add / edit / test / deactivate. Loc only.
- **`/_emdash/admin/weasley-clock/availability`** — plugin page for `availability_rules` (weekly schedule editor). Loc only.
- **`/_emdash/admin/weasley-clock/bookings`** — plugin page listing upcoming bookings with one-click cancel. Loc only.
- **`/_emdash/admin/weasley-clock/feed`** — plugin page listing / rotating `private_feeds` secrets. Loc only.

## Operational defaults (user-approved)

| Concern | Default |
|---------|---------|
| Sync cron frequency | 10 min per active source; per-source override |
| Feed failure handling | Retain prior data; email after 3 consecutive failures |
| Event disappearance | Soft-delete (`deleted=1`), never row-delete |
| Free/busy recheck | Atomic D1 batch (SELECT free/busy + INSERT booking in one batch) at booking commit |
| Booking rate limit | 3/hr/email-hash, 10/hr/IP-hash |
| Minimum notice | 24h default, per-meeting-type override |
| Advance cap | 30 days default, per-meeting-type override |
| CAPTCHA | None initially; add Turnstile if spam surfaces |
| Family event reminders | 7-day and 1-day-before email to `loc.truongh@gmail.com` + `tam@huuloc.com` |
| Booking reminders | 24-hour-before to guest + Loc; day-of morning digest to Loc |
| SMS / push | Not in scope |
| TZ — household view | Always `Asia/Ho_Chi_Minh` |
| TZ — guest booking | Auto-detect from browser, editable dropdown |
| TZ — storage | UTC everywhere |
| Cancellation | One-click via token URL in confirmation email; tokens hashed in DB |
| Private feed secret | 32-char base32 via `crypto.getRandomValues` |
| Private feed rotation | Admin button regenerates; old URL 404s |
| Private feed rate limit | 6 req/hr/IP |
| Private feed auth | Secret-in-URL only (Google polls unauthenticated) |

## Error handling

- **ICS parser:** on malformed VEVENT, log + skip that event. Do not fail the entire feed. Preserve `last_sync_status='ok'` if ≥50% of events parsed; `error` otherwise.
- **Sync cron:** bounded concurrency (process sources sequentially within a single cron fire; parallel firings can overlap harmlessly because of `UNIQUE (source_id, external_uid)`).
- **Booking concurrency race** (two guests race for same slot): resolved by D1's atomic batch semantics — both requests run their SELECT-then-INSERT as one batch; D1 serialises them; the second request's SELECT sees the first's INSERT and returns 409. The winner's email still sends.
- **Resend failure** on confirmation email: the booking is still committed (the `.ics` backstop will catch it). A retry job re-attempts the email after 5 min; if it fails 3×, plugin admin surface shows a warning banner and a "resend manually" button.
- **Lunar conversion out-of-range:** the library supports 1900–2100. Outside that range, `solarToLunar` returns `null` and the UI falls back to showing Gregorian only with a subtle warning.
- **Dates at DST boundaries:** everything stored in UTC; rendering layer uses `Intl.DateTimeFormat` with explicit IANA zones. Hour ranges in `availability_rules.weekly_schedule` are stored as local-clock strings (`"09:00"`) and interpreted in `availability_rules.timezone` at evaluation time — deliberately so a "work 9–12" rule survives DST without us manually adjusting.

## Testing

### Unit
- **Lunar conversion:** golden dataset — Tết dates 1900–2100 from Hồ Ngọc Đức's tables; assert `lunarToSolar({month:1,day:1,year:Y}) === known_tet[Y]` for every Y. Similarly for arbitrary sampled dates.
- **Free/busy computer:** edge cases — back-to-back bookings, buffer overlap, events crossing midnight, DST transition days, all-day vs. timed, multiple overlapping synced sources.
- **ICS parser:** malformed VEVENT, UTF-8 Vietnamese diacritics, recurring events (RRULE expansion), cancelled events (STATUS:CANCELLED), all-day vs. timed.
- **Booking validator:** rate-limit triggers correctly; min-notice and max-advance respected; custom questions required/optional.

### Integration
- **Booking concurrency:** spawn 2 concurrent POSTs for the same slot; assert exactly one row in `bookings`, exactly one 409.
- **Cancellation end-to-end:** create → cancel via token → verify row `status='cancelled'`, verify token can't be reused, verify ICS feed regeneration excludes it.
- **Sync cron happy path:** mock ICS source, assert upsert semantics (new/changed/deleted transitions).
- **Private ICS endpoint:** fetch with valid secret returns correct VCALENDAR; fetch with revoked secret 404s; rate limit trips at 7th req/hr.

### No end-to-end browser tests initially
Astro pages are server-rendered; we assert API contracts and rendered HTML snapshots in isolation. Add Playwright only if a UI regression bug costs us real time.

## Security

- **Private ICS feed:** secret-in-URL with 32 chars of base32 (~160 bits) makes brute-force infeasible within any practical rate limit. Rate-limited to 6 req/hr/IP. Can be rotated from admin.
- **Booking tokens:** stored as SHA-256 hashes in `cancellation_token_hash`. The raw token only ever lives in the confirmation email and in the guest's client. Rotating the email doesn't invalidate — only admin revoke or expiration does. (Expiration: tokens valid until event end + 24h.)
- **Rate limiting:** IP and email hashed (SHA-256) before storing in `booking_attempts` — no raw PII in the limit ledger.
- **Input validation:** Zod (or equivalent) schema at the API edge for every POST. String fields length-capped; emails via RFC 5322 regex + `safe-regex` vetted. Custom question keys validated against the meeting_type's declared schema (no arbitrary keys).
- **HTML escaping:** all guest-controlled text (name, company, custom answers) escaped on render and in email templates. Use the project's existing `sanitize-html` dep (already patched in `6879fe41`).
- **SSRF on ICS fetch:** filter private IPs, localhost, link-local — use `ssrf-req-filter` or equivalent. Never fetch an arbitrary user-supplied URL without it.
- **Admin access:** relies on EmDash's existing admin auth. Tam gets an EmDash admin account; no new auth system.
- **Secrets at rest:** `ics_url` in `ics_sources` holds external secret iCal URLs. Not encrypted in D1 (D1 is encrypted at rest by Cloudflare). Admin page masks by default; show-on-click.

## HP naming + content strings

### Routes
- `/hogwarts/weasley-clock` — family dashboard
- `/hogwarts/weasley-clock/private/<secret>.ics` — private ICS feed
- `/hogwarts/time-turner/partners` — booking, style A
- `/hogwarts/time-turner/assistants` — booking, style B
- `/hogwarts/time-turner/openclaw` — booking, style A
- `/hogwarts/time-turner/cancel/<token>` — one-click cancellation
- `/_emdash/admin/weasley-clock/*` — plugin admin subpages

### Page titles
- EN: "The Weasley Clock" / "The Time-Turner — Partners" / "The Time-Turner — Personal Assistants" / "The Time-Turner — OpenClaw"
- VI: "Đồng Hồ Weasley" / "Xoay Cát — Đối Tác" / "Xoay Cát — Trợ Lý" / "Xoay Cát — OpenClaw"

### Copy tone
- **Weasley Clock:** warm, household. "LOC · WORK · TAM · HOME." "This week." "Coming flights." Family-facing first.
- **Time-Turner partners / openclaw:** professional. "Book a turn with Loc." "Your turn is set." The HP motif is in the frame, not the language.
- **Time-Turner assistants:** themed. "I have used it, Harry, to re-do hours." "Each grain is thirty minutes." "Tell the hourglass who you are." Narrative copy for the closer audience.

### Hogwarts navigation entry

The `/hogwarts/*` index page gains two entries alongside Library, Games, and Quidditch:
- **The Weasley Clock** — "The family's clock. Dương and âm lịch, giỗ and flights, everyone's hands." — link to `/hogwarts/weasley-clock`.
- **The Time-Turner** — "For those who'd like to meet me." — link to `/hogwarts/time-turner/partners` (most public audience).

## Rules compliance

- `src/data/site-routes.json` will be updated: add `/hogwarts/weasley-clock`, `/hogwarts/time-turner/partners`, `/hogwarts/time-turner/assistants`, `/hogwarts/time-turner/openclaw`. Private ICS and cancel routes are excluded from the sitemap.
- All user-facing strings ship with both EN and VI.
- All pages `Astro.cache.set(cacheHint)` — though bookings & family views cache-hint `{ tags: ["weasley-clock"] }` and are invalidated on booking commit / family event edit (short TTL).
- `output: "server"` — no `getStaticPaths` on anything that reads `synced_events` or `bookings`.
- `link()` is only used inside `/pensieve/*`. All Weasley Clock / Time-Turner routes use absolute paths.
- `target="_blank"` only on external URLs (guest's Zoom link, etc.), never on in-site `/hogwarts/*` routes.
- Image fields on `family_events.photo` use `<Image image={...} />` from `"emdash/ui"`.
- Timestamps in hook scripts computed via `node -e "new Date().toISOString()"`, never `date +%3N`.

## Open questions / future work

Explicitly deferred; NOT in this spec.

- **Two-way sync** (OAuth to Google Calendar). Would unlock: instant slot-block on booking in work cal, read work-cal attendance. Revisit after 3 months of ICS-only experience.
- **Household view for Tam's own calendars.** Requires (a) her to supply ICS URLs, and (b) deciding whether to merge or separate. Revisit when she asks.
- **Public family events.** `family_events.visibility='public'` is modelled but no public surface yet; future site-wide "today in Trương household" footer widget.
- **Plugin marketplace publication.** The plugin is usable beyond this site; once stable, publish to `marketplace.emdashcms.com`.
- **Group booking** (multiple attendees for one slot). Cal.com supports "Round Robin" and "Collective"; we start 1:1.
- **Payment-gated meetings.** Out of scope; if needed, Stripe → plugin hook on booking commit.
- **Recurring bookings** (weekly 1:1). Not in v1; guests book individually.
- **Calendar holidays** (public Vietnamese holidays, bank holidays). Can add a pre-populated ICS source later — no schema change needed.

## Implementation phasing (for the plan)

Each phase is shippable on its own. Proposed order:

1. **Phase 1 — Plugin scaffold + family events only.** Collections, lunar module, Weasley Clock dashboard. No sync, no booking. Proves the data model, the dual-calendar UI, Tam's admin access.
2. **Phase 2 — Sync-in.** ICS sources + cron + synced_events table. Weasley Clock starts showing work events alongside family ones.
3. **Phase 3 — Booking engine (A layout).** Availability rules, meeting types, booking API, free/busy computer, email fulfillment. Ship `/partners` and `/openclaw` only.
4. **Phase 4 — Private ICS feed.** Closes the booking → Google loop.
5. **Phase 5 — B layout.** The Turn, hourglass UI for `/assistants`.
6. **Phase 6 — Reminders + admin polish.** Scheduled reminder emails, plugin admin UI for feeds / availability / bookings / feed-secret rotation.

The writing-plans skill will decompose Phase 1 into a concrete implementation plan.
