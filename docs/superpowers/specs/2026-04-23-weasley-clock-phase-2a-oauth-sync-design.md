# Weasley Clock Phase 2a — OAuth-based multi-account calendar sync

**Date:** 2026-04-23
**Supersedes:** §Scope Q2 ("ICS feeds only") and §Data model `ics_sources` / `synced_events` of `2026-04-23-weasley-clock-time-turner-design.md`. Everything else in the main spec stands.
**Status:** Design pending user approval; written after Phase 1 ship.
**Relationship to Phase 1:** Phase 1 shipped family_events (hand-curated), Weasley Clock views, plugin scaffold, and the `meeting_types` collection schema. This phase adds the `sync-in` subsystem — the first real hooks the plugin-weasley-clock package will carry.

## Why this delta

The original spec's Q2 decision (ICS-only) was chosen to avoid OAuth's ~5× implementation cost. It breaks for Loc's setup: his Google Calendars produce ICS URLs that hide event titles (privacy default). An ICS-only pipeline would show "busy" blocks without descriptions — useless for a household dashboard that needs to render "SQ186 HAN→SGN" or "Sprint review · VNG".

OAuth on Google Calendar returns full event details (title, location, description, attendees, attachments), supports incremental sync via `syncToken`, and scales cleanly across multiple Google accounts (VNG work, personal, OpenClaw when that Google Workspace is provisioned).

## What changes

**From the main spec's locked Q2 decision:**
- Old: ICS feeds only, Cloudflare cron-driven, read-only one-way
- New: **Hybrid.** Primary path is Google OAuth per-account with full event detail + incremental sync. Secondary path is ICS for sources that don't have OAuth (airline apps, public-holiday calendars, future Outlook-personal). Both feed the same `synced_events` table.

**Non-goals unchanged from main spec:**
- Still no two-way sync (OAuth is *read-only* — we request `calendar.readonly` scope only).
- Still no SMS/push.
- Still no auto-ingestion of *every* possible calendar — user must explicitly connect each account.

**New non-goals explicit to this phase:**
- **No Outlook / Microsoft OAuth.** Only Google for now. The abstraction supports adding more providers later, but shipping them is out of scope.
- **No Google Workspace admin-consent flow.** Personal-account consent only. Loc's VNG Workspace may require a consent screen whitelist; we'll handle that case operationally, not in-app.
- **No calendar-write capabilities.** Booking fulfillment still lands via `.ics` attachment + private subscribed ICS (from main spec §Booking fulfillment — unchanged). OAuth is ingestion-only.

## Locked decisions (new Qs)

| # | Question | Choice |
|---|----------|--------|
| 2a.1 | OAuth client setup | Single Google Cloud Console project registered to `huuloc.com`; one OAuth 2.0 Client ID used across all user accounts |
| 2a.2 | Scope requested | `https://www.googleapis.com/auth/calendar.readonly` only — not `calendar` or `calendar.events`. Read-only is the minimum that unlocks full event titles + incremental sync |
| 2a.3 | Number of connected accounts | Unlimited (soft-capped at ~5 in UI to discourage accidents). First-class multi-account UX |
| 2a.4 | Account scope selection | Per account, user picks which of their calendars to sync (opt-in, not all-by-default — avoids slurping shared-company calendars they never look at) |
| 2a.5 | Token encryption | AES-GCM with a site-wide key stored in Cloudflare secrets (wrangler secret). Not relying on D1-at-rest encryption alone |
| 2a.6 | Sync cadence | Incremental sync via `syncToken` every 5 min (access token lasts 1h → refresh takes < 1s → cheap to run frequently). On `syncToken` invalidation, full resync |
| 2a.7 | Push notifications | Not in scope. Google's Calendar push channels (webhook-based, watch API) are a Phase 2b add-on — the 5-min poll covers household-use latency |
| 2a.8 | ICS hybrid retention | Keep `ics_sources` table. Used for airline apps + future Outlook-personal. Same `synced_events` destination |

## Architecture additions

```
              ADD: OAuth subsystem                      UNCHANGED: ICS fallback
              ────────────────────                      ───────────────────────
   oauth_accounts (new table)                              ics_sources (unchanged)
     │                                                         │
     │ per-account sync cron (5 min)                          │ cron (10 min)
     │   ├─ Refresh access token                              │   ├─ Fetch feed
     │   ├─ events.list(syncToken)                            │   ├─ Parse VEVENT
     │   └─ Upsert into synced_events                         │   └─ Upsert into synced_events
     │        where source_type='gcal'                        │        where source_type='ics'
     │                                                         │
     └──────────────────────┬────────────────────────────────┘
                            │
                      synced_events (shared destination, new source_type discriminator)
                            │
                    [ rest unchanged: free/busy computer → dashboard + time-turner ]
```

## Data model changes

### `ics_sources` — unchanged (still scoped to non-Google feeds)

### `synced_events` — add discriminator

```sql
ALTER TABLE synced_events ADD COLUMN source_type TEXT NOT NULL DEFAULT 'ics';
  -- values: 'ics' | 'gcal'
ALTER TABLE synced_events ADD COLUMN gcal_account_id TEXT REFERENCES oauth_accounts(id) ON DELETE CASCADE;
ALTER TABLE synced_events ADD COLUMN gcal_calendar_id TEXT;
  -- Google calendar id (e.g. "primary" or "abc@group.calendar.google.com")

-- source_id (existing FK → ics_sources) stays nullable and is populated
-- only when source_type='ics'. For 'gcal' rows, source_id is null and
-- gcal_account_id + gcal_calendar_id identify the row's provenance.

-- Update UNIQUE constraint to accommodate both provenance shapes:
-- Drop old UNIQUE(source_id, external_uid);
-- Add UNIQUE(source_type, COALESCE(source_id,''), COALESCE(gcal_account_id,''),
--           COALESCE(gcal_calendar_id,''), external_uid);
```

### New table `oauth_accounts`

```sql
CREATE TABLE oauth_accounts (
  id                      TEXT PRIMARY KEY,               -- ULID
  provider                TEXT NOT NULL,                   -- 'google' (only value for now; schema supports future 'microsoft')
  account_email           TEXT NOT NULL,                   -- resolved from OAuth userinfo, e.g. "loc@vng.com.vn"
  display_name            TEXT,                            -- optional friendly label in admin UI
  access_token_enc        TEXT NOT NULL,                   -- AES-GCM, base64
  access_token_iv         TEXT NOT NULL,                   -- base64 IV for access token
  refresh_token_enc       TEXT NOT NULL,                   -- AES-GCM, base64
  refresh_token_iv        TEXT NOT NULL,                   -- base64 IV for refresh token
  access_token_expires_at TEXT NOT NULL,                   -- ISO 8601
  scope                   TEXT NOT NULL,                   -- space-separated granted scopes
  status                  TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'revoked' | 'error'
  last_sync_error         TEXT,
  connected_at            TEXT NOT NULL,
  last_synced_at          TEXT,
  revoked_at              TEXT
);
CREATE INDEX idx_oauth_accounts_status ON oauth_accounts(status);
```

### New table `oauth_calendars`

Per-account list of Google calendars + which ones are opted in.

```sql
CREATE TABLE oauth_calendars (
  id                 TEXT PRIMARY KEY,                     -- ULID
  account_id         TEXT NOT NULL REFERENCES oauth_accounts(id) ON DELETE CASCADE,
  calendar_id        TEXT NOT NULL,                         -- Google calendar id (e.g. 'primary', 'birthdays@group.v.calendar.google.com')
  summary            TEXT,                                  -- Google's calendar summary/title
  time_zone          TEXT,                                  -- calendar's default TZ (e.g. 'Asia/Ho_Chi_Minh')
  background_color   TEXT,                                  -- Google's assigned color hex (for UI tint)
  access_role        TEXT,                                  -- owner | writer | reader | freeBusyReader
  synced             INTEGER NOT NULL DEFAULT 0,            -- 1 = opted into sync; 0 = visible in UI but not synced
  sync_token         TEXT,                                  -- Google's syncToken for incremental list
  last_resynced_at   TEXT,
  expose_titles      INTEGER NOT NULL DEFAULT 1,            -- 0 = free/busy only on Weasley Clock (hide titles on household surface); 1 = show
  UNIQUE (account_id, calendar_id)
);
CREATE INDEX idx_oauth_calendars_synced ON oauth_calendars(synced) WHERE synced=1;
```

### New table `oauth_state`

Short-lived CSRF state tokens for the OAuth handshake.

```sql
CREATE TABLE oauth_state (
  state       TEXT PRIMARY KEY,                             -- random 32-char
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,                                -- 10 minutes after created_at
  return_url  TEXT                                          -- where admin UI should redirect back after callback
);
```

A cron job purges `oauth_state` rows past `expires_at`.

## OAuth flow

### Step 1 — Initiate (admin UI)

Admin clicks **Connect Google account** on `/_emdash/admin/weasley-clock/feeds`.

1. Server generates random 32-char `state`, inserts into `oauth_state` with 10-min expiry.
2. Server redirects user to Google's auth URL:
   ```
   https://accounts.google.com/o/oauth2/v2/auth
     ?client_id=<OAUTH_CLIENT_ID>
     &redirect_uri=https://huuloc.com/api/oauth/google/callback
     &response_type=code
     &scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly
     &access_type=offline            ← mandatory to get a refresh_token
     &prompt=consent                  ← forces refresh_token on re-consent (Google only emits it on first grant otherwise)
     &state=<state>
     &login_hint=<email if admin provided one>
   ```

### Step 2 — Callback

Google redirects to `https://huuloc.com/api/oauth/google/callback?code=<code>&state=<state>`.

1. Validate `state` against `oauth_state` table (present, non-expired). Delete row on match or reject.
2. Exchange `code` for tokens: POST `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`.
3. Response contains `access_token`, `refresh_token`, `expires_in`, `scope`, `id_token`.
4. Decode `id_token` (JWT) locally — extract `email`, `name`. No need to hit userinfo endpoint.
5. Encrypt both tokens with AES-GCM using site-wide key (`OAUTH_ENC_KEY`) — each token gets its own 96-bit IV.
6. UPSERT into `oauth_accounts` keyed by `(provider='google', account_email)`. If row exists, overwrite tokens + set `status='active'` + clear `last_sync_error`. If new, insert.
7. Call `GET https://www.googleapis.com/calendar/v3/users/me/calendarList` to enumerate calendars. Upsert each into `oauth_calendars` with `synced=0` (user opts in per calendar).
8. Redirect admin back to `/_emdash/admin/weasley-clock/feeds` with a success flash.

### Step 3 — Calendar opt-in

Admin UI lists each account's calendars as toggle cards with the Google-assigned color swatch. Clicking the toggle flips `oauth_calendars.synced` 0↔1. On opting in, the next cron run fetches a full listing (no `syncToken` yet) and lands events into `synced_events`.

### Step 4 — Ongoing incremental sync

A Cloudflare cron trigger runs **every 5 minutes**. For each `oauth_calendars WHERE synced=1`:

```
1. Decrypt access_token; if expired (within next 60s), refresh:
   POST https://oauth2.googleapis.com/token { grant_type: 'refresh_token', refresh_token, client_id, client_secret }
   Update oauth_accounts with new access_token + new expiry.

2. GET https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events
     ?syncToken=<oauth_calendars.sync_token if set, else omit>
     &showDeleted=true
     &singleEvents=true                     ← expand recurring events into concrete instances
     &maxResults=250

3. On HTTP 410 Gone (sync_token invalidated by Google — happens after ~30 days of inactivity or server-side eviction):
     Clear sync_token; next run does a full refresh instead of incremental.

4. On HTTP 200:
     For each event:
       - If status='cancelled' or event.deleted=true: soft-delete synced_events row by UID.
       - Else: UPSERT synced_events with source_type='gcal', gcal_account_id, gcal_calendar_id, external_uid=event.id, title, starts_at, ends_at, all_day, location, description.
     After all pages consumed (nextPageToken cycle), save the final response's nextSyncToken into oauth_calendars.sync_token.
```

Token refresh bypassed when the current token has > 60s remaining. Expected steady-state: one refresh per account per hour, ~12 `events.list` calls per calendar per hour.

### Step 5 — Revocation + error handling

- **User clicks "Disconnect account"** in admin UI: server POSTs `https://oauth2.googleapis.com/revoke?token=<refresh_token>` (best-effort; don't block on failure), then sets `oauth_accounts.status='revoked'`, cascades to delete `oauth_calendars` rows, cascades to delete `synced_events WHERE gcal_account_id=<id>`. User sees "Account removed."
- **Token refresh fails with `invalid_grant`** (refresh token revoked by user in Google account settings): set `oauth_accounts.status='revoked'` + `last_sync_error`, show banner in admin UI prompting re-connect.
- **Token refresh fails with 5xx** (transient): retry with exponential backoff; preserve `status='active'`.
- **events.list returns 403** (quota / permission): log to `last_sync_error`; alert Loc via resend after 3 consecutive failures.

## Security

- **`OAUTH_ENC_KEY`** — 256-bit key stored via `wrangler secret put OAUTH_ENC_KEY`. Rotation procedure documented in a runbook (rotate key → re-encrypt all stored tokens using the old key to decrypt, new key to encrypt, in a migration script). Never commit the key.
- **AES-GCM** via Web Crypto (`crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)`). IVs are random per-token, stored alongside ciphertext, never reused.
- **`client_secret`** — OAuth client secret from Google Cloud Console. Stored via `wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET`. `client_id` is NOT a secret; checked into env config.
- **CSRF on OAuth callback** — the `state` token protects against a malicious site redirecting to our callback URL with a forged `code`. 10-min TTL, one-time use, deleted on match.
- **`id_token` verification** — verify JWT signature against Google's public keys from `https://www.googleapis.com/oauth2/v3/certs` (cached). Do not trust the payload without signature check.
- **Refresh-token scarcity** — Google emits a refresh token only on first grant (unless `prompt=consent`). On re-connect of an existing account, our code uses `prompt=consent` so we always get a fresh refresh token rather than losing sync on re-auth.
- **Scope downgrade** — if Google returns a narrower scope than requested (user can unselect scopes on Google's consent screen), reject the grant with a clear admin-UI error: "Please grant calendar read access — calendar sync requires it."
- **Redirect URI** — exactly `https://huuloc.com/api/oauth/google/callback`. On dev (`localhost:4321`), the OAuth app is configured with BOTH redirect URIs in the Google Cloud Console; the callback route selects which to use based on `Astro.request.url.hostname`.
- **D1 encryption at rest** — supplementary, not primary. AES-GCM provides defense-in-depth.
- **Log hygiene** — never log raw tokens, `code`, `state`, or decrypted ciphertext. Logs only record `oauth_account_id`, account_email, operation, outcome.

## UI additions on admin surface

Extends `/_emdash/admin/weasley-clock/feeds` (plugin admin page) with a new section:

```
[ Google accounts ]

  ┌─────────────────────────────────────────────────────────────┐
  │ 🟢  loc@vng.com.vn · VNG Work                              │
  │     Connected 2026-04-23 · Last sync 3 min ago             │
  │     Calendars: 5 total, 2 synced                          │
  │     [ Manage calendars ]  [ Re-authorise ]  [ Disconnect ]│
  └─────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────┐
  │ 🟢  loc.truongh@gmail.com · Personal                       │
  │     ...                                                    │
  └─────────────────────────────────────────────────────────────┘

  [ + Connect another Google account ]

[ ICS feeds ] — unchanged from main spec
  ...
```

Clicking **Manage calendars** opens a modal listing all calendars for that account with a toggle each:

```
  ◎ Primary (work) · loc@vng.com.vn · Asia/Ho_Chi_Minh · 324 events        [ ON ]
  ◎ Birthdays                                                             [ OFF ]
  ◎ VNG all-hands                                                         [ ON ]
  ◎ Shared · Product roadmap                                              [ ON ]
  ◎ Vietnamese holidays                                                   [ OFF ]
```

With an **"Expose event titles on Weasley Clock"** checkbox per calendar — defaults to ON, but user can flip to OFF for a sensitive calendar that should appear only as free/busy on the household dashboard.

## Migration from main spec's `ics_sources`

The main spec scoped Phase 2 as "ICS-sync only". Phase 2a **supersedes** Phase 2. Concretely:

- The `ics_sources` + ICS cron subsystem STILL ships (airlines, public holidays, legacy feeds), but is demoted from primary to secondary.
- If Loc has already populated `ics_sources` with his Google Workspace ICS URLs (pre-OAuth era), those rows should be migrated or deleted when the corresponding Google account is OAuth-connected. Plan task: detect overlap and prompt admin ("You already have this calendar via ICS — remove the ICS source now that it's connected via OAuth?").

## Testing

### Unit
- **Token encryption round-trip** — encrypt + decrypt recovers exact plaintext; different IVs per call.
- **OAuth state validation** — expired / unknown / consumed states all rejected; one-time use.
- **JWT ID-token verification** — signed tokens accepted; tampered tokens rejected; wrong-`aud` rejected.
- **Calendar upsert logic** — duplicate-calendar-id updates same row; insert vs update branches correct.
- **Event upsert** — status=cancelled soft-deletes; status=confirmed refreshes; deleted=true handled per Google's convention.
- **Sync-token invalidation** — 410 Gone clears sync_token and triggers full resync on next run.

### Integration
- **End-to-end OAuth flow** (against a Google OAuth sandbox project, not prod): `GET /api/oauth/google/initiate` → redirect → mocked Google responds with `code` → `GET /api/oauth/google/callback` → verify row inserted + tokens decrypt correctly.
- **Calendar list + opt-in** — on first connect, `oauth_calendars` has expected rows; flipping `synced=1` triggers initial fetch on next cron.
- **Incremental sync** — seed 3 events, trigger sync, assert inserts. Update 1 + delete 1 via Google, trigger sync, assert updates + soft-delete. Save+restore sync_token across runs.
- **Token refresh** — mock access_token expiring in 30s, run sync, assert token refreshed, assert sync proceeds.
- **Revocation** — invalid_grant response sets status='revoked' and raises admin banner; expected events.list calls don't happen afterwards.

### Manual
- Connect one real Google Workspace account → pick one calendar → wait 5 min → verify events appear on Weasley Clock.
- Disconnect → verify events disappear from dashboard.
- Revoke access via Google's security settings → verify next sync run marks account revoked and banner appears.

## HP naming + strings

- Admin section title: **"Owl Post — Calendar Owls"** (EN) / **"Bưu điện Cú — Cú báo lịch"** (VI). Each connected Google account is an "owl" that delivers calendar events.
- Connect button: "Send an owl to Google" / "Gửi cú đến Google".
- Disconnect button: "Call the owl home" / "Gọi cú về".
- Error banner: "The owl was lost — reconnect" / "Cú mất đường — kết nối lại".

## Implementation phasing (for writing-plans)

Suggested Phase 2a breakdown:

1. **P2a.1 — Token crypto + oauth_accounts + oauth_state tables.** Pure plumbing; unit-testable without any Google traffic.
2. **P2a.2 — OAuth initiate + callback routes.** Complete the handshake against a Google sandbox. No syncing yet.
3. **P2a.3 — Calendar discovery + oauth_calendars table + opt-in toggles.** Admin UI for picking which calendars to sync.
4. **P2a.4 — Incremental sync cron + events.list integration + synced_events upsert.** The meat. Includes token-refresh path + sync_token handling.
5. **P2a.5 — Weasley Clock rendering of synced events.** Update DayView's hourly column + WeekView cells to show timed events (was placeholder in Phase 1).
6. **P2a.6 — Revocation, error handling, admin banners.** Polish for the unhappy path.

Phase 2b (deferred, own spec): push-notification channels via Google's `events.watch` for sub-minute latency.

## Open questions

- **Admin auth.** Which EmDash user(s) can connect an OAuth account? Current assumption: any EmDash admin. Tam gaining OAuth-connect authority means she could connect *her* Google calendar if desired — does that cross into the "shared household" Q1 decision? Probably fine — the account is tied to `oauth_accounts` not to a user identity, and she opts in per calendar, so it remains a household resource.
- **Google Workspace consent screen.** VNG's Workspace may have domain-wide restrictions on third-party OAuth apps. Mitigation: user connects their personal account instead; or request a Workspace admin whitelist. Operational, not design-time.
- **Calendar visibility during partial sync.** If a new account is connected mid-week, should its events back-fill historical weeks too? Current plan: initial fetch uses `timeMin = now - 90 days` to avoid dumping infinite history. Open question — configurable?
- **Per-calendar TZ handling.** Google returns events in each calendar's TZ; we normalise to UTC for storage. Display always in Asia/Ho_Chi_Minh on the Weasley Clock. This is straightforward but worth calling out — VNG calendar events scheduled in UTC should render at HCMC time on the dashboard.
