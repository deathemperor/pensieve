# Weasley Clock Booking — Phase 4 (Round-Robin Hosts) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** When a `meeting_type` has multiple entries in `host_account_ids`, the slot picker shows a slot as available if ANY listed host is free, and a new booking is auto-assigned to the least-recently-booked host who is free at that slot.

**Builds on Phase 1+2+3.** Round-robin was schema-ready since Phase 1 (host_account_ids is already JSON-array). This phase wires the actual multi-host logic.

---

## Scope

- Modify `slots.ts` — for each candidate slot, check which hosts are free; surface as available if any are.
- Modify `booking-create.ts` — pick the assigned host at create time (least-recently-booked among free hosts at the slot). Tiebreak by lexicographic id.
- **No** reschedule reassignment — keep the same host on reschedule (the GCal event lives on their calendar).
- **No** UI change — the slot picker continues to show one slot per time; assignment is invisible to the guest.

---

## Algorithm

### Slot availability across hosts

```
for each host in meeting_type.host_account_ids:
  busyWindows[host] = synced_events for that host's synced calendars
  freeSlotsByHost[host] = computeSlots(rule, busyWindows[host], duration, buffers, ...)

mergedSlots = union of all freeSlotsByHost values, deduplicated by start_iso
```

The slots endpoint returns mergedSlots. The slot picker's UX is unchanged — guests see "this time is available" without knowing how many hosts are eligible.

### Host assignment at booking create

When a booking POST arrives with `slot_start_iso`:

```
candidateHosts = []
for each host in meeting_type.host_account_ids:
  if computeSlots(host's rule + busy + ...).find(s => s.start_iso === slot_start_iso):
    candidateHosts.push(host)

if candidateHosts.length === 0:
  throw BookingError("Slot no longer available", "slot_unavailable")

# Pick least-recently-booked (fewest confirmed bookings in next 30 days)
counts = countConfirmedBookingsNext30Days(candidateHosts)
sortedHosts = sort candidates by [counts asc, host_id asc]
assignedHost = sortedHosts[0]
```

The `host_account_id` written to the bookings row is the assigned host — used for ALL future operations (cancel uses that host's token, reschedule revalidates against that host's availability).

---

## File structure

```
src/lib/weasley-clock/
  multi-host.ts       # NEW: helpers — buildBusyWindowsByHost, mergeSlotsByHost, pickAssignedHost
  booking-create.ts   # MODIFY: use pickAssignedHost when multiple hosts; otherwise unchanged
src/pages/api/weasley-clock/bookings/
  slots.ts            # MODIFY: merge slots across multiple hosts
```

No schema changes. No new routes. No new admin UI.

---

## Task 1: `multi-host.ts` helper

Create `src/lib/weasley-clock/multi-host.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";
import { computeSlots, type BusyWindow, type Slot } from "./availability";
import type { AvailabilityRuleData } from "./storage";

export async function buildBusyWindowsForHost(
	db: D1Database,
	hostAccountId: string,
): Promise<BusyWindow[]> {
	const c = collections(db);
	const cals = (await c.oauth_calendars.list()).filter(
		(r) => r.data.account_id === hostAccountId && r.data.synced === 1,
	);
	const calIds = new Set(cals.map((r) => r.data.calendar_id));
	const eventsRes = await db
		.prepare(
			`SELECT json_extract(data, '$.starts_at') AS s,
			        json_extract(data, '$.ends_at') AS e,
			        json_extract(data, '$.gcal_calendar_id') AS cid,
			        json_extract(data, '$.deleted') AS del
			 FROM _plugin_storage WHERE plugin_id='weasley-clock' AND collection='synced_events'`,
		)
		.all<{ s: string; e: string; cid: string; del: number | null }>();
	return (eventsRes.results ?? [])
		.filter((r) => calIds.has(r.cid) && !r.del)
		.map((r) => ({ start_iso: r.s, end_iso: r.e }));
}

export function unionSlots(slotsByHost: Record<string, Slot[]>): Slot[] {
	const seen = new Map<string, Slot>();
	for (const slots of Object.values(slotsByHost)) {
		for (const s of slots) {
			if (!seen.has(s.start_iso)) seen.set(s.start_iso, s);
		}
	}
	return Array.from(seen.values()).sort((a, b) => a.start_iso.localeCompare(b.start_iso));
}

export function hostsAvailableAt(
	slotsByHost: Record<string, Slot[]>,
	slotStartIso: string,
): string[] {
	const out: string[] = [];
	for (const [host, slots] of Object.entries(slotsByHost)) {
		if (slots.some((s) => s.start_iso === slotStartIso)) out.push(host);
	}
	return out;
}

export async function pickAssignedHost(
	db: D1Database,
	candidateHosts: string[],
): Promise<string> {
	if (candidateHosts.length === 1) return candidateHosts[0];
	const c = collections(db);
	const all = await c.bookings.list();
	const nowMs = Date.now();
	const horizonMs = nowMs + 30 * 24 * 3600 * 1000;
	const counts: Record<string, number> = Object.fromEntries(candidateHosts.map((h) => [h, 0]));
	for (const r of all) {
		if (r.data.status !== "confirmed") continue;
		if (!counts.hasOwnProperty(r.data.host_account_id)) continue;
		const startMs = new Date(r.data.slot_start_iso).getTime();
		if (startMs >= nowMs && startMs <= horizonMs) {
			counts[r.data.host_account_id]++;
		}
	}
	const sorted = candidateHosts.slice().sort((a, b) => {
		if (counts[a] !== counts[b]) return counts[a] - counts[b];
		return a.localeCompare(b);
	});
	return sorted[0];
}
```

Commit: `feat(weasley-clock): multi-host helpers — busy windows, slot union, round-robin pick`.

---

## Task 2: Slots endpoint multi-host

Modify `src/pages/api/weasley-clock/bookings/slots.ts`:

- Parse `host_account_ids` JSON array as before.
- For each host: build busy windows, run `computeSlots`. Store in `slotsByHost`.
- Return `unionSlots(slotsByHost)`.
- For backward compat with single-host clients, also return `host_id: hostIds[0]` (the picker doesn't need the actual assignment yet — that happens at booking time).

Replace the current single-host busy-window query with a per-host loop using `buildBusyWindowsForHost`.

Commit: `feat(weasley-clock): slots endpoint merges availability across multiple hosts`.

---

## Task 3: Booking create round-robin assignment

Modify `src/lib/weasley-clock/booking-create.ts`:

After loading meeting type + parsing `hostIds`:

```ts
if (hostIds.length === 0) throw new BookingError(...);

// For each host, build busy windows + run computeSlots over ±1 day window.
const slotsByHost: Record<string, Slot[]> = {};
for (const hostId of hostIds) {
	const busy = await buildBusyWindowsForHost(input.db, hostId);
	slotsByHost[hostId] = computeSlots({ ...with this host's busy ... });
}

// Find which hosts have the requested slot.
const candidates = hostsAvailableAt(slotsByHost, input.slotStartIso);
if (candidates.length === 0) {
	throw new BookingError("Slot no longer available", "slot_unavailable");
}

// Pick assigned host.
const assignedHostId = await pickAssignedHost(input.db, candidates);
```

Use `assignedHostId` for ALL subsequent operations: token decrypt, GCal insert, bookings row write. Remove the existing `hostIds[0]` fallback.

Commit: `feat(weasley-clock): round-robin host assignment on booking create`.

---

## Task 4: Smoke test + PR + deploy

- Push branch
- PR with test plan: create a meeting_type with 2 host_account_ids → verify slots include union of both hosts' availability → make a booking → check the bookings row has the least-loaded host's id → make another booking at the same slot (impossible since first one consumed it) → make a booking at a slot only one host is free → verify that host is assigned regardless of load.
- Squash-merge, deploy.

---

## Self-review checklist

- Reschedule still uses original `host_account_id` (no reassignment) ☐
- Cancel still uses original `host_account_id` ☐
- Single-host meeting_types behavior unchanged (perf: still one host iteration) ☐
- Round-robin tiebreak deterministic (host_id sort) ☐
- Slot revalidation in booking-create now per-host ☐

---

## Out of scope

- Reassigning bookings if a host leaves (e.g., revoked OAuth) — manual ops task
- "Sticky" host preference (always assign the same host to the same guest email) — future
- Per-host buffer/availability differences — would need per-host meeting_type overrides; punt
- Visualising "who got assigned" in admin UI — punt; viewable in D1 directly
