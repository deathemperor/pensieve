# Trương About Page — Mage Upgrade

**Date:** 2026-04-21
**Page:** `/Trương` (source: `src/pages/Trương.astro`, 4002 lines)
**Status:** Design approved; implementation plan to follow

## Why

The About page has four problems:

1. **Stale facts** — "shipping 37+ AI agents" and "232 commits" in the Claude Code era are hand-typed values sitting next to live GitHub data, so they rot on their own schedule.
2. **Undersold career** — the narrative credits one VNG invention (session management). Loc's Facebook archive shows he also shipped Vietnam's first SSO, a Passport system doing 200k monthly registrations, the Gunny revival, and is currently building Oasis at Papaya — none of which appear on the page.
3. **No community history** — Loc has been *deathemperor* on gamevn.com since at least Dec 2002, was active on vBulletin.org, is currently reconstructing the defunct holvn.org forum from Wayback snapshots (live at `/hol`), and is head admin of the Rô Mỹ (American Cichlids Vietnam) Facebook group. The page mentions none of this.
4. **Eclectic-magic aesthetic** — the portrait has ~20 magical effects layered on, but the motifs fight each other (dreamcatcher + zodiac + photography + CRT + HP + alchemy). The user identifies as *mage/wizard*, not as *retro poster with astrology sprinkles*. The effects need to coalesce around one archetype.

## What (three changes)

### 1. Content refresh (facts + new section)

- **Subtitle** (hero): replace *"Engineer. Writer. Fishkeeper."* with the 8 roles Loc supplied: *Teacher · Engineer · Father · Servant · Writer · Fishkeeper · Tech Evangelist · Explorer.* Render as middle-dot-separated list that wraps gracefully. VI variant: *Giáo viên · Kỹ sư · Cha · Người phục vụ · Nhà văn · Người nuôi cá · Nhà truyền bá công nghệ · Nhà thám hiểm.*
- **Hero meta "GitHub" row**: replace hand-typed *"Since 2013 · 44 public repos · shipping 37+ AI agents"* with `Since {year of ghUser.created_at} · {public_repos + owned_private_repos} repos · ∞ AI agents`. Repo count is live from `ghUser`; the agent count becomes `∞` — the aspirational/ongoing framing (any concrete number goes stale too fast to be meaningful). VI variant: `Từ {year} · {n} kho mã · ∞ AI agent`.
- **Narrative prose — VNG paragraph**: expand the one-line "session management" credit into a paragraph that names four VNG achievements with years, pulled directly from the Facebook post at `seed.json:2023`:
  - 2007 — session-management mechanism → thousands of concurrent users on *Võ Lâm Truyền Kỳ* out-of-game events
  - 2008 — co-built Passport → 200k monthly registrations
  - 2009 — **Vietnam's first SSO** → 10+ game launches/month
  - Gunny revival → 1k → 100k+ concurrent users, millions → 30B+ VND/month, helped kill FPT Games' competing line
- **Narrative prose — new Papaya paragraph**: append a short paragraph on the current chapter: building **Oasis** at Papaya, an AI-agent-as-Service-As-A-Software platform. Source: `seed.json:3996`.
- **Coding eras timeline**: the Solo (pre-2022) and Copilot (2022–Jan 2026) numbers are historical and stay. The Claude Code era's "232 commits" is current-through-some-date — compute it live from the same GraphQL query the page already makes (the `ghToken`-gated block around `Trương.astro:86`) by scoping `contributionsCollection.from` to `2026-01-29T00:00:00Z` (era start) and displaying the returned `totalCommitContributions`. Fallback to the current hardcoded 232 if the API call fails.
- **New Community section (placed above the narrative, part of the origin story)**: add a new `<section class="about-section">` between the hero and the narrative prose, titled *"Community" / "Cộng Đồng"*. Four cards laid out as a responsive grid, reusing the visual pattern of the existing `.repo-card` (GitHub Activity → Recent repositories section) for consistency. Each card carries: handle + forum/group name as the heading, role as a small label, one-sentence context, optional link.
  - **gamevn.com** — *deathemperor* since 2002 — Vietnam's biggest gaming forum; early threads on Sim City 4, KOTOR, and the rest of the 2000s console-PC era. Link: profile (if accessible).
  - **vBulletin.org** — active contributor in the forum-software community.
  - **holvn.org (HOL)** — currently reconstructing this defunct Vietnamese vBulletin forum from Wayback snapshots; the reconstruction lives at `/hol` on this site.
  - **Rô Mỹ (American Cichlids Vietnam)** — head admin of the Facebook group, led the 2021 admin-team evolution.

### 2. Aesthetic consolidation (mage workshop)

Direction: **Architect-Mage with Scholar-Wizard undertone** — a mage's workshop at the moment of invention, not a duel.

**Keep** (already mage-adjacent; no changes):
- Runes ring around portrait (`.portrait-runes-ring`)
- Levitating runestones (`.portrait-runestones`)
- Golden Snitch orbit (`.portrait-snitch-wrap`)
- Flying owl silhouette (`.portrait-owl`)
- Spinning gold coin (`.portrait-coin-wrap`)
- Ornate baroque filigree frame (`.portrait-baroque`, `.portrait-filigree-*`)
- Creeping vines (`.portrait-vines`)
- Rose-window circular pattern (`.portrait-rose-window`) — reads as arcane circle
- Lotus petals (`.portrait-lotus`) — personal significance

**Cut** (competing aesthetics — delete HTML + CSS + any JS driving them):
- Zodiac wheel (`.portrait-zodiac`) — astrology, not mage
- Sweeping clock hands (`.portrait-clock`) — photography motif
- Camera aperture iris (`.portrait-aperture`) — photography motif
- Photo negative flash (`.portrait-negative-flash`) — photography motif
- Lens flare + diffraction rainbow (`.portrait-lens-flare`, `.portrait-diffraction`) — photography motif
- CRT scan lines (`.portrait-scan-lines`) — tech-nostalgia, wrong register
- Halftone dots (`.portrait-halftone`) — pop-art, wrong register
- Chromatic aberration photo ghosts (`.portrait-chromatic`) — photography motif
- Stained-glass pattern (`.portrait-stained-glass`) — competes with rose window
- Mercury blobs (`.portrait-mercury`) — alchemy, visually sloppy
- Frost crystals (`.portrait-frost-tl`, `.portrait-frost-br`) — wrong season/mood
- Sunburst rays (`.portrait-sunburst`) — retro poster, not mage
- Ocean wave silhouette (`.portrait-waves`) — redundant with fishkeeper subtitle/prose
- Dreamcatcher web (`.portrait-web`) — native-American spiritual motif, off-register
- **(Addendum, approved 2026-04-21 after full-file survey — 13 additional cuts)** ⤵
- Compass (`.portrait-compass`) — nautical wayfinding, competes with rose window
- Ribbon (`.portrait-ribbon`) — ornamental, non-mage
- Soundwaves (`.portrait-soundwaves`) — audio motif, off-register
- Drips (`.portrait-drips`) — alchemical, off-register
- Feathers (`.portrait-feathers`) — owl already covers the bird motif
- Echo (`.portrait-echo`) — audio motif, off-register
- Pool (`.portrait-pool`) — water motif; fishkeeping theme handled in subtitle/prose
- Bubbles (`.portrait-bubbles`) — water motif; same reason as pool
- Orbits (`.portrait-orbits`) — will be redundant with the new summoning circle
- Bird (`.portrait-bird`) — owl already covers
- Rain (`.portrait-rain`) — off mood for invention-moment workshop
- Holo (`.portrait-holo`) — holographic tech register, not mage
- Alchemy (`.portrait-alchemy`) — alchemy is a different archetype
- Mandala (`.portrait-mandala`) — borderline; cutting for decisiveness (can add back if sparse)

**Explicitly keep** (structural/layout — do not touch):
`.portrait-card`, `.portrait-filters` (SVG filter `<defs>`), `.portrait-vignette`, `.portrait-edge-glow`, `.portrait-trace`.

**Keep** (additional mage-adjacent effects, discovered in the full-file survey):
`.portrait-sigil`, `.portrait-hallows` (Deathly Hallows — explicit HP), `.portrait-patronus` (HP), `.portrait-portkey` (HP), `.portrait-lightning`, `.portrait-lightning-fork`, `.portrait-runes` (distinct from the runes ring), `.portrait-constellation`, `.portrait-stars-bg`, `.portrait-aurora`, `.portrait-mist`, `.portrait-wisps`, `.portrait-dust`, `.portrait-sparkles`, `.portrait-shooting-stars`, `.portrait-halo`, `.portrait-vortex`, `.portrait-crystal`, `.portrait-flames`, `.portrait-sheen`.

**Add** (the new mage layer; each is a new `.portrait-*` element with matching CSS):

1. `.portrait-summoning-circle` — two concentric rings of glyphs slow-rotating counter to each other, behind the portrait in the visual slot vacated by the zodiac. Inner ring: Elder Futhark runes (reuse the set from the existing `.portrait-runes-ring`). Outer ring: Arabic invention years in a serif capitals face — `2007 · 2008 · 2009 · 2024` — so a visitor can read the concrete career years around the portrait while the runes stay decorative. **No `∞` or future year** — the past is inscribed; the future stays unwritten.
2. `.portrait-grimoire-pages` — 2–3 translucent parchment sheets, each with faint handwritten sigil diagrams (SVG), floating and drifting with subtle parallax.
3. `.portrait-light-threads` — glowing line segments drawing a 3D schematic lattice beside the portrait, SVG stroke-dash-animated to look like it's being *drawn* in light.
4. `.portrait-circuit-runes` — 4–6 sigils placed in corners where the Futhark glyph shape morphs into PCB traces via SVG path animation.
5. `.portrait-candle-glow` — warm radial gradient overlay (warm tungsten tone) that flickers on a long cycle. Replaces the cold photography lighting cast by the removed lens flare.
6. `.portrait-ink-bleed` — four ink droplets at frame corners that slowly bloom into small rune glyphs and hold, using SVG filter + mask animation.
7. `.portrait-incantation` — a line of handwritten script that fades in on `:hover` of the photo, rising from the bottom edge. Copy (bilingual, "magical unimaginable" register — an Architect-Mage's profession-of-art rather than a workaday note). Recommended default:
   - EN: *"I do not cast spells. I build them."*
   - VI: *"Tôi không đọc bùa chú. Tôi viết ra chúng."*

   Alternatives available if Loc wants a different register:
   - (a) EN: *"Speak the word, and the lattice answers."* / VI: *"Thốt một lời, mạng lưới đáp về."*
   - (b) EN: *"Every line is a rune. Every rune is a door."* / VI: *"Mỗi dòng là một rune. Mỗi rune là một cánh cửa."*

   The implementation plan will use the default unless Loc picks one of the alternatives.

**Color / light tone shift:** raise warm tones (gold, candle amber, ink sepia). Lower the cold blues from lens-flare / frost / CRT scan that are being removed.

### 3. Live-data refactor (fragility fix)

Today, three strings in the hero and eras are hand-typed: public-repo count, "37+ AI agents", and the coding-eras Claude Code commit count. After this change: the repo count and Claude Code commit count read from the live GitHub data; the agent count becomes `∞` (intentional, non-numeric). Tolerance: if the GitHub fetch fails, the page falls back to last-known-good static values rendered inline (keep current behaviour — the `try/catch` at `Trương.astro:78-110` already handles this).

## Non-goals

- No redesign of the GitHub Activity section (eras timeline, day-of-week chart, repos grid, activity feed stay as-is apart from the Claude Code era live-count).
- No changes to the base layout, navigation, or bilingual wiring.
- No changes to other pages. Root-level absolute paths retained for all new links.
- No new dependencies. All new effects use SVG + CSS keyframes (same approach as existing effects).
- No changes to `seed/seed.json` — this is a page refresh, not a content-model change.

## Implementation boundaries

One file changes: `src/pages/Trương.astro`. Expected delta:
- ~200 lines deleted (cut effects + their CSS)
- ~250 lines added (new effects + CSS + new Community section + expanded prose + new Papaya paragraph)
- ~15 lines modified (hero meta computed strings, subtitle, Claude Code era live-count, narrative VNG paragraph)

Net: file stays in the 4000-line range. No new files.

## Risk / rollback

All changes are visual + content on one page. No data migrations. Rollback = `git revert`.

## Review checklist (apply when implementing)

- [ ] `Astro.cache.set(cacheHint)` remains on the page
- [ ] No `target="_blank"` on in-site links (e.g. `/hol`)
- [ ] New EN strings have VI pairs; new VI strings have EN pairs
- [ ] `link()` helper *not* used (this is a root-level page, absolute paths only)
- [ ] GitHub API call stays in the existing cached `ghFetchOpts` block
- [ ] `seed.json` quotations match source (no paraphrasing of inventions)
- [ ] No `localhost:300x` URLs leak in
- [ ] No new route → no `src/data/site-routes.json` update needed (confirm: this is an existing page, just edited)
