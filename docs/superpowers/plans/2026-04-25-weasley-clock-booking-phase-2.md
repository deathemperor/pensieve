# Weasley Clock Booking — Phase 2 (Cancel / Reschedule / Reminders) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Booking lifecycle — guests can cancel or reschedule via tokenised links in their confirmation email, and a cron sends 24-hour reminders.

**Builds on Phase 1:** all collections, helpers, and patterns are already in place. Tokens (`cancel_token`, `reschedule_token`) are already generated + stored on the bookings row at create time.

**Tech stack:** same as Phase 1 (Astro SSR, D1, KV, Resend, Cloudflare Cron Triggers).

**Phase 2 scope:**
- Cancel flow (page + API + email + GCal delete)
- Reschedule flow (page + API + email + GCal update)
- 24-hour reminder cron + reminder email template
- Wire all four email templates from Phase 1 (`booking-confirmation` + new `cancellation` + `rescheduled` + `reminder`)

---

## File structure

```
src/pages/book/cancel/[token].astro       # NEW: cancel landing page
src/pages/book/reschedule/[token].astro   # NEW: reschedule slot picker
src/pages/api/weasley-clock/bookings/
  cancel.ts                                # NEW: POST cancel
  reschedule.ts                            # NEW: POST reschedule
src/lib/weasley-clock/
  booking-cancel.ts                        # NEW: cancelBooking() helper
  booking-reschedule.ts                    # NEW: rescheduleBooking() helper
  email.ts                                  # MODIFY: add 3 new templates
src/components/book/
  RescheduleSlotPicker.tsx                 # NEW: Reschedule-aware variant of SlotPicker
src/worker.ts                               # MODIFY: scheduled() handler — add 24h reminder pass
wrangler.jsonc                              # MODIFY: add reminder cron line if not already
```

---

## Task 1: Cancel helper (`booking-cancel.ts`)

**Files:** Create `src/lib/weasley-clock/booking-cancel.ts`.

- [ ] **Step 1: Implement**

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";
import { ensureFreshAccessToken } from "./token-refresh";
import { BookingError } from "./booking-create";

export interface CancelBookingInput {
	db: D1Database;
	encKey: string;
	clientId: string;
	clientSecret: string;
	cancelToken: string;
}

export interface CancelBookingResult {
	bookingId: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	slotStartIso: string;
	slotEndIso: string;
	timezone: string;
	wasAlreadyCancelled: boolean;
}

export async function cancelBooking(input: CancelBookingInput): Promise<CancelBookingResult> {
	const c = collections(input.db);

	// Find booking by cancel_token. Use the index — list + filter for now;
	// switch to indexed query if perf becomes a concern.
	const all = await c.bookings.list();
	const row = all.find((r) => r.data.cancel_token === input.cancelToken);
	if (!row) throw new BookingError("Booking not found", "not_found");

	if (row.data.status === "cancelled") {
		// Idempotent: already cancelled. Return existing data so the page
		// can render "this booking has been cancelled".
		return toResult(row, /* meetingTitle is fetched below */ "", true);
	}

	// Decrypt + refresh host token, delete the GCal event.
	const acctRow = await c.oauth_accounts.get(row.data.host_account_id);
	if (acctRow && row.data.gcal_event_id) {
		try {
			const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken({
				accountRow: acctRow,
				encKey: input.encKey,
				clientId: input.clientId,
				clientSecret: input.clientSecret,
				expirySkewSec: 300,
			});
			if (refreshed) {
				try { await c.oauth_accounts.put(row.data.host_account_id, updatedRow.data); }
				catch (err: any) { console.error("[wc/cancel] persist refreshed token failed:", err?.message ?? err); }
			}
			const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(row.data.gcal_event_id)}?sendUpdates=all`;
			const res = await fetch(url, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${access_token}` },
			});
			if (!res.ok && res.status !== 410) {
				// 410 means already deleted — fine. Other non-2xx: log + continue.
				console.error(`[wc/cancel] GCal delete failed ${res.status}: ${await res.text()}`);
			}
		} catch (err: any) {
			console.error(`[wc/cancel] GCal delete exception:`, err?.message ?? err);
		}
	}

	// Update bookings row → status="cancelled", cancelled_at=now.
	const now = new Date().toISOString();
	await c.bookings.put(row.id, {
		...row.data,
		status: "cancelled",
		cancelled_at: now,
	});

	// Pull meeting title for the email/page.
	const { getEmDashCollection } = await import("emdash");
	const { entries: mts } = await getEmDashCollection("meeting_types");
	const mt = (mts ?? []).find((e: any) => e.id === row.data.meeting_type_id);
	const meetingTitle = mt ? (mt.data?.title_vi ?? mt.title_vi ?? mt.data?.title_en ?? mt.title_en ?? "Meeting") : "Meeting";

	return toResult({ ...row, data: { ...row.data, status: "cancelled", cancelled_at: now } }, meetingTitle, false);
}

function toResult(row: any, meetingTitle: string, wasAlreadyCancelled: boolean): CancelBookingResult {
	return {
		bookingId: row.id,
		guestEmail: row.data.guest_email,
		guestName: row.data.guest_name,
		meetingTitle,
		slotStartIso: row.data.slot_start_iso,
		slotEndIso: row.data.slot_end_iso,
		timezone: row.data.timezone,
		wasAlreadyCancelled,
	};
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/weasley-clock/booking-cancel.ts
git commit -m "feat(weasley-clock): cancelBooking helper — GCal delete + status update"
```

---

## Task 2: Cancel API route + page

**Files:**
- Create: `src/pages/api/weasley-clock/bookings/cancel.ts`
- Create: `src/pages/book/cancel/[token].astro`

- [ ] **Step 1: API route** — POST receives `{ cancel_token }`, calls `cancelBooking()`, sends cancellation email (non-fatal), responds with summary. Wrap in try/catch (Astro adapter re-run pattern). Map `BookingError "not_found"` → 404, others → 500.

- [ ] **Step 2: Cancel landing page** — server-renders booking summary by token, shows confirm button that POSTs the cancel API and on success shows "Cancelled" state. Handle the "already cancelled" idempotent case gracefully ("This booking is already cancelled").

- [ ] **Step 3: Add `sendCancellationEmail()` in `email.ts`** — bilingual, plaintext + HTML, sender + reply-to identical to confirmation email.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/weasley-clock/bookings/cancel.ts src/pages/book/cancel/[token].astro src/lib/weasley-clock/email.ts
git commit -m "feat(weasley-clock): cancel flow — page + API + email"
```

---

## Task 3: Reschedule helper (`booking-reschedule.ts`)

**Files:** Create `src/lib/weasley-clock/booking-reschedule.ts`.

- [ ] **Step 1: Implement**

The reschedule helper:
1. Find booking by `reschedule_token`. 404 if missing.
2. Validate new `slot_start_iso` is in the available set via `computeSlots` (same revalidation as createBooking).
3. Compute new `slot_end_iso = slot_start_iso + duration`.
4. Decrypt+refresh host token; PATCH the existing `gcal_event_id` (don't delete+create, preserves event ID stability for the guest's calendar):
   ```
   PATCH https://www.googleapis.com/calendar/v3/calendars/primary/events/<id>?sendUpdates=all
   { "start": { "dateTime": <new_start>, "timeZone": "UTC" }, "end": { "dateTime": <new_end>, "timeZone": "UTC" } }
   ```
5. Update bookings row in place: `slot_start_iso` + `slot_end_iso` updated; **regenerate** `cancel_token` + `reschedule_token` (old links invalidated); `reminded_at` cleared (reminder fires again for the new time).
6. Return summary for the email.

- [ ] **Step 2: Commit**

```bash
git add src/lib/weasley-clock/booking-reschedule.ts
git commit -m "feat(weasley-clock): rescheduleBooking helper — GCal PATCH + token rotation"
```

---

## Task 4: Reschedule API route + page

**Files:**
- Create: `src/pages/api/weasley-clock/bookings/reschedule.ts`
- Create: `src/pages/book/reschedule/[token].astro`
- Create: `src/components/book/RescheduleSlotPicker.tsx` (variant of SlotPicker that posts to reschedule endpoint)

- [ ] **Step 1: API route** — same try/catch pattern as cancel/create. Body: `{ reschedule_token, slot_start_iso, guest_timezone }`. Returns `{ booking_id, confirmed_url, new_cancel_url, new_reschedule_url }`.

- [ ] **Step 2: Page shell** — looks up booking by token, shows current booking summary + new SlotPicker variant.

- [ ] **Step 3: RescheduleSlotPicker** — copy `SlotPicker.tsx`; differences:
  - Receives `bookingMeetingTypeId` + `currentSlotStartIso` as props (not via meeting-type slug)
  - Doesn't show form fields (name/email already on file) — just the slot picker
  - Submit calls `/api/weasley-clock/bookings/reschedule` with `reschedule_token` from URL

- [ ] **Step 4: `sendRescheduledEmail()` in `email.ts`** — bilingual, includes both old and new times.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weasley-clock/booking-reschedule.ts src/pages/api/weasley-clock/bookings/reschedule.ts src/pages/book/reschedule/[token].astro src/components/book/RescheduleSlotPicker.tsx src/lib/weasley-clock/email.ts
git commit -m "feat(weasley-clock): reschedule flow — page + API + email + slot picker variant"
```

---

## Task 5: 24-hour reminder cron

**Files:**
- Modify: `src/worker.ts`
- Modify: `wrangler.jsonc` (only if 10-min cron not present)
- Modify: `src/lib/weasley-clock/email.ts` (add `sendReminderEmail()`)

- [ ] **Step 1: Add `sendReminderEmail()`** in email.ts — bilingual, similar to confirmation but with 24h-out framing.

- [ ] **Step 2: scheduled() handler** — add a branch when the cron is `*/10 * * * *`:

```ts
if (event.cron === "*/10 * * * *") {
	try {
		const { runReminderPass } = await import("./lib/weasley-clock/reminders");
		await runReminderPass({
			db: env.DB,
			resendApiKey: env.RESEND_API_KEY,
		});
	} catch (err: any) {
		console.error("[cron] reminder pass exception:", err?.message ?? err);
	}
}
```

- [ ] **Step 3: Create `src/lib/weasley-clock/reminders.ts`** — `runReminderPass(input)`:
  - Query `bookings` where `status='confirmed' AND reminded_at IS NULL AND slot_start_iso BETWEEN now+23h AND now+24h`.
  - For each, look up meeting_type for title, send reminder email, write `reminded_at = now`.
  - Bound batch to 50 per pass to fit the Workers CPU budget.

- [ ] **Step 4: Verify cron exists** in `wrangler.jsonc` — `*/5 * * * *` is already there from Phase 2a (sync) — add `*/10 * * * *` if not present.

- [ ] **Step 5: Commit**

```bash
git add src/worker.ts src/lib/weasley-clock/reminders.ts src/lib/weasley-clock/email.ts wrangler.jsonc
git commit -m "feat(weasley-clock): 24h reminder cron + reminder email template"
```

---

## Task 6: Email confirmation template — wire cancel + reschedule URLs

**Files:** `src/lib/weasley-clock/email.ts` already accepts `cancelUrl` + `rescheduleUrl`. Verify the template renders them prominently in BOTH HTML and text bodies. If the Phase 1 implementation only put them in HTML, fix the text version.

- [ ] **Step 1: Audit + fix email.ts text body**
- [ ] **Step 2: Commit if changes needed**

---

## Task 7: i18n + final checks

- [ ] **Step 1:** All new pages and email templates bilingual VI/EN.
- [ ] **Step 2:** Confirm `src/data/site-routes.json` doesn't need updates (cancel/reschedule are dynamic routes, no static entry).
- [ ] **Step 3:** Run `node --import tsx --test 'tests/weasley-clock/**/*.test.ts'` — confirm Phase 1 tests still pass.

---

## Task 8: PR + merge + deploy + smoke test

- [ ] **Step 1:** Push branch, open PR.
- [ ] **Step 2:** Squash-merge.
- [ ] **Step 3:** Wait for deploy.
- [ ] **Step 4:** End-to-end:
  - Create a fresh test booking (Phase 1 flow).
  - Click cancel link in email — verify page renders, click confirm — verify GCal event deleted, cancellation email arrives.
  - Create another booking, click reschedule link — pick a new slot, submit — verify GCal event updated (same event ID), rescheduled email arrives with new + old times.
  - Wait until ~23h before a future booking; verify reminder email arrives within 10 min.

---

## Self-review checklist

- All new pages have `prerender = false` ☐
- All API routes wrap body in try/catch ☐
- BookingError typed errors mapped to correct HTTP status ☐
- Email failures non-fatal ☐
- Token rotation on reschedule (old links invalidated) ☐
- Reminder cron bounded (≤50 per pass) ☐
- All user-facing strings bilingual ☐

---

## Execution

Subagent-driven, fresh agent per task, two-stage review after each.
