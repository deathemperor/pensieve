# Room of Requirement — Hub Dashboard Redesign

## Problem

The RoR index page has grown to 7 sections stacked vertically (~950 lines of Astro). As new features are added (more agents, plugins, design docs), the page gets longer. It needs a layout that scales without becoming a scroll marathon.

## Solution

Convert the RoR index from a long vertical page into a compact hub dashboard. The hero stays. Everything else becomes a dense grid of summary panels. Growing sections (Task Observatory, Restricted Section, House-Elves, Plugins) link to dedicated sub-pages. Static sections (roles, architecture, source) stay inline as compact panels.

## Section Treatment

| Section | Treatment | Why |
|---------|-----------|-----|
| Hero | Stays as-is | Compact intro + diary/prophet links, never grows |
| What CC Does / Human | Panel → expands in-place | Static content, rarely changes |
| Architecture | Panel → expands in-place | 6 services, grows very slowly |
| Source | Panel → external link (GitHub) | Single link, never grows |
| Task Observatory | Summary panel → sub-page | Dynamic D1 data, already has sub-page |
| The Restricted Section | Summary panel → new sub-page | Growing collection of design docs |
| House-Elves | Summary panel → new sub-page | Agent list grows with the project |
| Plugins | Summary panel → new sub-page | Plugin list grows with the project |

## Dashboard Grid Layout

Below the hero, a 2-column CSS grid holds all panels:

```
┌─────────────────────────────────────────────┐
│  Hero (full width, same as current)         │
├─────────────────────────────────────────────┤
│ What CC Does (full width, one-line summary) │
├──────────────────────┬──────────────────────┤
│ Architecture         │ Source               │
│ [tag chips]          │ [GitHub link]        │
├──────────────────────┼──────────────────────┤
│ Task Observatory     │ Restricted Section   │
│ [6 dots + counts] → │ [badge counts]     → │
├──────────────────────┼──────────────────────┤
│ House-Elves          │ Plugins              │
│ [agent names]      → │ [plugin names]     → │
└──────────────────────┴──────────────────────┘
```

Mobile: single column, all panels stack vertically.

## Panel Anatomy

### Inline panels (no navigation)

Compact, non-interactive. Show key facts in minimal space.

- **What CC Does**: Two colored dot-label pairs ("Claude Code: 7 roles · Human: 5 roles") with a muted one-liner listing the role keywords.
- **Architecture**: Section title + row of tag chips (Astro, EmDash, Workers, D1, R2, KV). Links to external docs.
- **Source**: GitHub icon + `deathemperor/pensieve` monospace link.

### Navigable panels (link to sub-page)

Clickable cards with hover state. Show summary stats + `→` indicator.

- **Task Observatory**: 6 colored HP system dots with names, aggregate open/done counts. Links to existing `/room-of-requirement/task-observatory`.
- **Restricted Section**: Spec/plan badge counts, project count, total lines. Links to new `/room-of-requirement/restricted-section`.
- **House-Elves**: Comma-separated agent names, total count. Links to new `/room-of-requirement/house-elves`.
- **Plugins**: Comma-separated plugin names, total count. Links to new `/room-of-requirement/plugins`.

## New Sub-Pages

### `/room-of-requirement/restricted-section`

Dedicated page for The Restricted Section. Moves the current expandable list (stats bar + grouped `<details>` rows) from the index page to its own page. Same D1 query, same HTML, wrapped in Base layout with breadcrumb `Room of Requirement > The Restricted Section`.

### `/room-of-requirement/house-elves`

Dedicated page listing all agents with their purposes. Same data as current index section but with room for richer descriptions.

### `/room-of-requirement/plugins`

Dedicated page listing all plugins with their purposes. Same data as current index section.

## Data Sources

No new data sources needed. All panels read from the same D1 tables and static arrays already in the index page frontmatter:

- `techStack` array (architecture)
- `agents` array (house-elves)
- `plugins` array (plugins)
- `tasks` D1 table via `taskSystems` (task observatory)
- `design_docs` D1 table via `designDocs` (restricted section)

## Styling

Follow existing Pensieve visual system:
- Dark canvas `#0d1117`
- Cards: `var(--color-surface-elevated)` background, `var(--color-border)` border
- Monospace for stats/counts, Inter Tight for headings
- 2-column grid with `gap: var(--spacing-4)`, responsive to 1-column on mobile
- Full-width panels use `grid-column: 1 / -1`

## Animation System — "Seven Rooms, Seven Magics"

Three layers of magical interaction, all CSS-based:

### Layer 1: Staggered Materialize (page load)

Panels fade in one by one with a slight upward drift — like objects appearing in the Room of Requirement. Each panel delayed 80ms after the previous. Pure CSS `@keyframes` + `animation-delay`.

### Layer 2: Shimmer Border (hover)

Navigable panels get a conic-gradient border on hover — `background: conic-gradient(from 0deg, #58a6ff, #7c3aed, #d4a843, #58a6ff)` on a pseudo-element with `mask-composite: exclude`. Subtle glow filter behind it.

### Layer 3: Per-Panel Click Transitions

Each panel gets its own HP-themed transition when clicked. Every animation is CSS keyframes + minimal JS for particle spawning. The View Transitions API handles the actual page navigation (progressive enhancement — instant navigation in unsupported browsers).

| Panel | Animation | HP Artifact | Description |
|-------|-----------|-------------|-------------|
| Task Observatory | **Wand Trace Door** | Room of Requirement door | SVG stroke-dashoffset traces a gradient border. Panel swings open on a 3D hinge (`perspective` + `rotateY`). Sub-page revealed behind the door. |
| Restricted Section | **Pensieve Dive** | Dumbledore's Pensieve | Panel pulses with blue energy, then shrinks and sinks with blur + `translateY`. Concentric ripple rings emanate from center. Sub-page surfaces from below. |
| Plugins | **Floo Network** | Floo Powder fireplace | Green flame particles (`#3fb950`) rise from below. Panel dissolves in emerald fire (`inset box-shadow`). Destination appears through clearing smoke. |
| House-Elves | **Patronus Burst** | Patronus Charm | Silvery-white light (`rgba(200,220,255)`) builds inside, then erupts outward. 8 light rays shoot from center at 45° intervals. Panel dissolves into pure protective energy. |
| Architecture | **Apparition** | Side-Along Apparition | Panel compresses horizontally while stretching vertically (squeeze through a tube). White crack-flash at the moment of disapparation. Destination pops in. |
| Source | **Portkey** | Portkey activation | Panel wobbles (rotation oscillation), then spins violently with a golden swirl before vanishing. The "navel hook" pull effect. |
| What CC Does | **Vanishing Cabinet** | Draco's Vanishing Cabinet | Panel flickers in/out of existence with staggered opacity. Each phase less solid than the last. Finally vanishes, leaving destination behind. |

### Animation Technical Notes

- All transitions are CSS `@keyframes` — no animation libraries
- Particle effects (flames, ripples, rays) are JS-spawned `div` elements with CSS animations, auto-removed after animation completes
- View Transitions API for actual page navigation: `document.startViewTransition(() => navigation)` with fallback to `window.location.href`
- `view-transition-name` on panel title and sub-page heading for title morphing during transition
- `prefers-reduced-motion: reduce` disables all animations, falls back to instant navigation
- Mobile: same animations but with shorter durations (60% of desktop timing)

### Mockups

Interactive demos of all 7 animations are in `.superpowers/brainstorm/` — see `ror-magic-v4-all-seven.html`.

## Bilingual

All panel text EN/VI using existing `isVi` pattern. Sub-page titles and breadcrumbs bilingual.

## Site Routes

Add to `src/data/site-routes.json`:

```json
{
  "path": "/room-of-requirement/restricted-section",
  "title": "The Restricted Section",
  "titleVi": "Khu Cấm",
  "description": "Design specs and implementation plans",
  "descriptionVi": "Bản thiết kế và kế hoạch triển khai"
},
{
  "path": "/room-of-requirement/house-elves",
  "title": "House-Elves",
  "titleVi": "Gia Tinh",
  "description": "AI agents bound to specific duties",
  "descriptionVi": "Các tác tử AI gắn với nhiệm vụ cụ thể"
},
{
  "path": "/room-of-requirement/plugins",
  "title": "Plugins",
  "titleVi": "Plugins",
  "description": "EmDash plugins extending the CMS",
  "descriptionVi": "Các plugin EmDash mở rộng CMS"
}
```

## Out of Scope

- JavaScript-based scrollspy or client-side navigation
- Animation libraries (GSAP, Framer Motion, etc.) — pure CSS + minimal vanilla JS
- Moving the existing Task Observatory or Daily Prophet sub-pages (untouched)
- Server-side changes beyond page restructuring
