# Celestial Chronicle — Backlog

Items deferred / parked while we ship the current polish arc. Not spec'd to task-level detail yet — each would need its own design pass.

## Blocked on external input

- **Atlas real map tiles**
  Replace the graticule grid (now with simplified continent outlines) with Mapbox / Stadia / OSM dark tiles.
  **Blocker:** tile provider choice (paid vs free, license terms, API key management). Continent outlines landed in PR #61 as a stopgap.

- **Curated Timeline → Chronicle entries**
  `scripts/chronicle/promote-candidates.ts` already does the first pass — filters to single-visit ≥3h stays outside the top-5 home cities, keeps max 2 per year. Last run produced 14 draft candidates at `.session/chronicle-drafts.json`.
  **Blocker:** needs the author to rename placeholder titles ("Visit to X") into real life-event titles, OR discard those that were just transient. Admin-review work, not code.

## New architecture arcs (dedicated sessions)

- **Phase B save-hook upgrade**
  Convert the post-scan CLI into a real EmDash plugin hook that fires on post save/publish, auto-proposing draft Chronicle candidates in the admin queue.
  **Effort:** ~1 day; needs familiarity with the EmDash plugin runtime + capability grants.

- **Per-year "Wrapped" recap**
  Auto-generated year summary card (count, categories, places visited). Links from the year heading in the ledger.
  **Prerequisite:** more seed entries; currently 8 is too few for a meaningful recap.

## Small wins not in the current arc

All the previously-listed "small wins" have shipped:

- ✅ **Search widget** — `chronicle` added to LiveSearch collections (PR #60)
- ✅ **Atlas continent outlines** — hand-simplified polygons under the pin layer (PR #61)
- ✅ **Print stylesheet** — @media print strips everything but the ledger (PR #60)
- ✅ **Keyboard shortcut overlay** — `?` key or chip (PR #60)
- ✅ **Tags / themes** — comma-separated `tags` field + chip row (PR #60)
- ✅ **Story threads** — `thread` field + opt-in SVG line overlay (PR #61)
- ✅ **Featured image per entry** — `featured_image` field + permalink hero render (PR #61)

## Inbox

Nothing currently inboxed. Drop items here as they come up and we'll groom.
