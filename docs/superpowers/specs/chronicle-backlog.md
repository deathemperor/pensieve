# Celestial Chronicle — Backlog

Items deferred / parked while we ship the current polish arc. Not spec'd to task-level detail yet — each would need its own design pass.

## Blocked on external input

- **Atlas real map tiles**
  Replace the graticule grid with Mapbox / Stadia / OSM dark tiles.
  **Blocker:** tile provider choice (paid vs free, license terms, API key management).

- **Curated Timeline → Chronicle entries**
  Walk through the 666 candidates from `ingest-gmaps.ts`, filter to "Searched Address" + "Aliased Location" + single-visit high-probability records, promote ~10 of them to real entries with admin-named titles.
  **Blocker:** needs the author's judgment on what constitutes a meaningful life event vs routine travel.

## New architecture arcs (dedicated sessions)

- **Phase B save-hook upgrade**
  Convert the post-scan CLI into a real EmDash plugin hook that fires on post save/publish, auto-proposing draft Chronicle candidates in the admin queue.
  **Effort:** ~1 day; needs familiarity with the EmDash plugin runtime + capability grants.

- **Story threads / constellation lines**
  Faint SVG lines connecting thematically related entries (proposal → marriage → Fawn born; dad → mourning arc). Opt-in toggle.
  **Effort:** ~half day; needs a manual "thread" field on entries + UX design for the toggle.

- **Per-year "Wrapped" recap**
  Auto-generated year summary card (count, categories, places visited). Links from the year heading in the ledger.
  **Prerequisite:** more seed entries; currently 8 is too few for a meaningful recap.

- **Tags / themes beyond category**
  Schema-level feature. A new `tags` array field. Enables cross-category threading ("UK 2018" or "medical 2021") that category alone can't express.
  **Effort:** schema migration + admin UI + filter chips on the page.

- **Featured image per entry**
  New image field on the chronicle collection. Render in the modal and permalink page. Requires image uploads and R2 paths.

## Small wins not in the current arc

- **Search widget** — drop the site's `LiveSearch` component on the Chronicle page; `chronicle` collection already supports search.
- **Atlas continent outlines** — faint SVG silhouettes (Natural Earth 50m coastlines, stripped subset) so the map reads as a map, not a grid.
- **Print stylesheet** — clean ledger-only view for printing.
- **Keyboard shortcut overlay** — `?` shows key bindings (arrow keys, Escape, Tab).

## Inbox

Nothing currently inboxed. Drop items here as they come up and we'll groom.
