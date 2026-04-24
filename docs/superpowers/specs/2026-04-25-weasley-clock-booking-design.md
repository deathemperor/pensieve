# Weasley Clock Booking — Design Spec

**Goal:** Build cal.com-equivalent booking functionality native to huuloc.com.
Users land on a public booking page, pick a slot from available times
(computed against Loc's synced Google calendars), fill in name/email/answers,
and receive a confirmation email. Booked events appear on the Weasley Clock
dashboard via the existing 5-min Google Calendar sync.

**Scope excludes:**
- Payment integration
- Google Meet auto-creation (events have text `location` field only — physical
  address or "to be coordinated")
- Fancy bespoke admin UI (manage `meeting_types` + `availability_rules` via
  EmDash's generic collection CRUD at `/_emdash/admin`)

**Scope includes everything else cal.com does at its core:**
- Public booking pages per meeting type
- Availability engine with Google-Calendar busy awareness, buffers, min notice,
  max advance
- Slot picker with guest timezone selector
- Booking form with custom questions
- Writes Google Calendar event via Loc's stored OAuth token
- Confirmation, cancellation, reschedule, reminder emails (Resend plugin)
- Cancel + reschedule tokens in emails
- Audience tag filtering (hide/show meeting types per segment)
- 24-hour reminder cron
- Round-robin between multiple hosts (schema-ready, single-host MVP)
- Public API + webhooks for programmatic access

---

## Architecture

Stays 100% in the Cloudflare Workers + Astro + EmDash + D1 stack. No sibling
services. No new runtime dependencies outside what's already bundled.

**Routes:**

```
GET  /book                              # list meeting types (audience-filtered)
GET  /book/<meeting-slug>               # slot picker page
POST /api/weasley-clock/bookings/slots  # returns available slots for a date window
POST /api/weasley-clock/bookings        # create booking
GET  /book/confirmed/<booking-id>       # post-booking "you're booked" page
GET  /book/cancel/<cancel-token>        # cancellation confirmation page
POST /api/weasley-clock/bookings/cancel # cancel endpoint
GET  /book/reschedule/<reschedule-token># reschedule slot picker
POST /api/weasley-clock/bookings/reschedule

# API + webhooks
GET  /api/weasley-clock/public/bookings # Bearer-auth, list bookings
POST /api/weasley-clock/public/webhooks # admin-only: register webhook
```

**Data model (all in `_plugin_storage` under `weasley-clock`):**

| Collection | Key fields |
|---|---|
| `meeting_types` (already seeded) | meeting_slug, title_en/vi, description, duration_min, audience_tags[], availability_id, buffer_before, buffer_after, min_notice_hrs, max_advance_days, questions[], color, host_account_ids[] |
| `availability_rules` (NEW) | id, label, timezone, weekly_hours {mon..sun: [{start_hhmm, end_hhmm}]}, date_overrides[] |
| `bookings` (NEW) | id, meeting_type_id, host_account_id, slot_start_iso, slot_end_iso, timezone, guest_name, guest_email, guest_answers{}, gcal_event_id, status (confirmed/cancelled), cancel_token, reschedule_token, created_at, cancelled_at, reminded_at |
| `api_keys` (NEW) | id, hash, label, scopes[], created_at, last_used_at |
| `webhook_endpoints` (NEW) | id, url, events[], secret, active, created_at |

**Extensions to `meeting_types` schema:** add `host_account_ids` (JSON array of
oauth_account ids). Single entry for solo meetings, multiple for round-robin.

---

## Availability engine

Pure function: `computeSlots(meetingType, availabilityRule, busyWindows, dateRange, guestTz) → Slot[]`

1. Start with weekly hours of the availability rule, projected into the
   requested dateRange (each day becomes zero-or-more free intervals in the
   rule's timezone).
2. Apply `date_overrides` (per-date replacement intervals — vacations, special
   hours).
3. Subtract `busyWindows` (events with `.starts_at < intervalEnd AND .ends_at > intervalStart`)
   taken from `synced_events` for any calendar where `synced=1` belonging to
   any of the meeting type's host accounts. Apply `buffer_before` / `buffer_after`
   on each busy window.
4. Slice remaining free intervals into fixed-duration slots based on
   `duration_min`. Slots are on the hour/half-hour/quarter-hour boundary
   appropriate for duration (30 → :00/:30, 60 → :00, 15 → :00/:15/:30/:45).
5. Filter: drop slots that start within `min_notice_hrs` from now, or beyond
   `max_advance_days`.
6. Return slots as UTC ISO strings. The client-side picker translates to
   `guestTz` for display.

For round-robin: run the above per host, merge sets, assign each rendered slot
to whichever host has the fewest upcoming confirmed bookings. Assignment is
stored on the booking row when creation happens (not at slot render time).

---

## Booking creation flow

1. Client `POST /api/weasley-clock/bookings` with `{ meeting_type_id, slot_start, guest_name, guest_email, guest_answers, guest_timezone }`.
2. Server re-runs `computeSlots` for the chosen slot's day, checks that `slot_start` is still in the available set. If not → 409 Conflict.
3. For round-robin meeting types, pick host now via least-recently-booked heuristic on confirmed bookings.
4. Decrypt the host's OAuth access_token (refresh if expired — existing `token-refresh` helper handles this).
5. POST to Google Calendar API `events.insert` on the host's primary calendar with:
   - `summary`: meeting_type.title
   - `description`: guest answers rendered as markdown
   - `start.dateTime` / `end.dateTime` (UTC)
   - `attendees`: [{ email: guest_email, displayName: guest_name }]
   - `location`: meeting_type's default location text (or blank)
   - **No** `conferenceData` → no Google Meet link
6. On 2xx, write `bookings` row with `gcal_event_id`, cancel_token (ULID), reschedule_token (ULID). Status `confirmed`.
7. Trigger Resend confirmation email (template with VI/EN based on guest preference or default VI).
8. Fire any registered webhooks matching `booking.created`.
9. Return `{ booking_id, cancel_url, reschedule_url, confirmed_url }`.

---

## Cancel / Reschedule flow

- Cancel link in email → `GET /book/cancel/<token>` → shows booking summary + confirm button.
- Confirm → `POST /api/weasley-clock/bookings/cancel` → deletes GCal event, sets `status=cancelled`, `cancelled_at=now`, sends cancellation email, fires `booking.cancelled` webhook.
- Reschedule link → slot picker pre-filtered to the same meeting type and host → POST creates new booking (new id, new tokens), deletes old GCal event, sets old booking `status=cancelled` with marker `rescheduled_to=<new_id>`. Sends rescheduled email. Fires `booking.rescheduled`.

Tokens: 32-char base32 ULIDs, single-use (a cancelled booking's cancel token returns "already cancelled").

---

## Reminders

New cron entry in `wrangler.jsonc`: `"*/10 * * * *"`. Handler in `src/worker.ts`:

```
SELECT bookings WHERE
  status='confirmed' AND reminded_at IS NULL
  AND slot_start BETWEEN now+23h AND now+24h
```

For each: send reminder email, set `reminded_at`.

---

## Emails (Resend plugin)

Four templates (HTML + plaintext, VI + EN):
- `booking-confirmation.{vi|en}` — "You're booked" with time in guest tz, location, cancel + reschedule links
- `booking-cancellation.{vi|en}` — acknowledgement
- `booking-rescheduled.{vi|en}` — updated details, new tokens
- `booking-reminder.{vi|en}` — 24h ahead

All sent from `bookings@huuloc.com` (Resend-verified sender).

---

## Public API

Auth: `Authorization: Bearer <api_key>`. Key stored hashed (SHA-256) in `api_keys`. Scopes: `bookings:read`, `bookings:write`.

```
GET  /api/weasley-clock/public/bookings?audience=<tag>&status=confirmed&from=<iso>&to=<iso>
# Returns bookings filtered by audience tag + date window.
# Bearer key must have `bookings:read` scope.
```

Partners / PAs can GET `audience=partner` to see their relevant bookings.

API key management: new admin page `/_emdash/admin/plugins/weasley-clock/api-keys` — generate key, set label + scopes, shown once, then only hash stored. Uses existing weasley-clock plugin admin entry.

---

## Webhooks

`webhook_endpoints` registered via admin UI. On each booking event (created, cancelled, rescheduled), POST payload to each active endpoint whose `events[]` includes the event type.

Payload signed with HMAC-SHA256 using `secret`. Header: `X-WC-Signature: sha256=<hex>`. Body: JSON `{ event, timestamp, data }`.

Admin page `/_emdash/admin/plugins/weasley-clock/webhooks` — list, create, toggle active, rotate secret.

---

## Audience tag filtering

`meeting_types.audience_tags` is an array of strings (e.g. `["public"]`, `["partner"]`, `["pa"]`).

Public `/book` index shows meeting types where `audience_tags` intersects with the URL's `?audience=` param, defaulting to `"public"`. `/book/<slug>` directly renders the specific type regardless (link is the gating mechanism).

URLs:
- `huuloc.com/book` → public slate
- `huuloc.com/book?audience=partner` → partner slate (unlisted, shared by link)
- `huuloc.com/book?audience=pa` → PA slate

Each slate is discoverable only by someone who has the link. No authentication.
Security model: audience tag is a soft filter, not a secret — anyone who knows
a meeting type's slug can book it. If Loc needs stronger gating for a type,
that's a future extension (booking password / invitation token).

---

## Existing code reused

- `src/lib/weasley-clock/storage.ts` — Collection<T> wrapper → extend with new collections
- `src/lib/weasley-clock/token-refresh.ts` — already handles expired access tokens
- `src/lib/weasley-clock/crypto.ts` — tokens decrypted for Google Calendar API call
- `plugin-resend` — existing Resend plugin for transactional email
- `getCurrentLang`, bilingual pattern — used everywhere on the site

---

## Security / hardening

- Slot creation re-validates availability server-side (double-booking prevention)
- Cancel/reschedule tokens are ULIDs (128 bits, unguessable)
- API keys hashed SHA-256, not stored in plaintext
- Webhook payloads HMAC-signed
- Rate-limit `POST /api/weasley-clock/bookings` per IP (leverage existing `pensieve-engage` rate limiter pattern or KV counter)
- Email addresses validated before storage (basic regex + DNS MX check optional)

---

## Non-goals (explicit)

- Payment — not building
- Google Meet / Zoom integration — not building; `location` is a plain text field
- Calendar invite .ics attachment — Google Calendar invites the guest directly; no need for our own .ics
- Multi-language beyond VI + EN
- Recurring bookings
- Group bookings (multiple attendees beyond host + guest)
- Admin UI beyond what's needed for API keys + webhooks (meeting_types and availability_rules use EmDash generic CRUD)
- Native mobile apps

---

## Delivery phases

**Phase 1 — Core booking (MVP, ~1-2 sessions):**
- availability_rules + bookings collections
- computeSlots function with tests
- `/book` index + `/book/<slug>` slot picker + confirmation form
- POST bookings endpoint
- Google Calendar event creation
- Confirmation email

**Phase 2 — Lifecycle (~1 session):**
- Cancel + reschedule flows
- Email templates for all four states
- 24-hour reminder cron
- `/book/confirmed/<id>` post-booking landing

**Phase 3 — API + webhooks (~1 session):**
- api_keys collection + admin page
- Public GET /bookings with Bearer auth
- webhook_endpoints collection + admin page
- HMAC-signed webhook dispatch on booking events

**Phase 4 — Round-robin (if time permits, ~0.5 session):**
- Multi-host meeting types
- Least-recently-booked assignment at slot-creation time

Total estimate: ~3-5 focused sessions for Phases 1-3. Phase 4 optional.

---

## Resolved decisions

1. **Default availability rule:** 7 days/week 09:00-17:30 Asia/Ho_Chi_Minh (include weekends).
2. **Default `host_account_ids` on existing `meeting_types`:** `loc.truongh@gmail.com` (Loc's *personal* Google account, not Papaya work).
3. **Location default:** `"To be coordinated via email"` when meeting_type leaves it blank.
4. **Email sender:** `loctruongh@gmail.com` via Resend. *NOTE — Resend can send "from" a Gmail address only when that address has been verified in the Resend dashboard. Confirm this is set up; if not, the first production email will bounce.* Plaintext Reply-To also set to this address.
5. **Rate limit:** 5 booking attempts per IP per hour, enforced via KV counter.
