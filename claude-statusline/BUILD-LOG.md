# HUD Build Log

A chronological record of how this RPG character-HUD status line was built —
the requests that drove each change and the commit that shipped it. Curated
from the build session; only the status-line work is included.

> Note: the build happened inside a working session that also contained
> unrelated, confidential work. This log is a **hand-curated extract** of just
> the HUD thread — the raw session transcript is deliberately **not** published
> (it carries proprietary code, infra identifiers, and customer data that must
> not land in a public repo).

---

## Phase 1 — Scaffold the RPG HUD (2026-06-04)

The seed: *"improve this to be more game-like, like RPG games — Final Fantasy
pixel imagery preferred."* Mapped session telemetry onto RPG stats and drew a
pixel portrait.

| Commit | What shipped | Driven by |
|---|---|---|
| `c24e20d1` | RPG character HUD + legend; HP=context, MP=rate-limit, EXP, Gold=cost, portrait | "make it RPG / FF pixel art", "what's gonna be HP?", "model icon should be a wizard" |
| `1b6d222d` | Rename Gil→Gold (💰); agent-oriented README | "Gil → Gold (WoW gold)", "write README for another Claude Code, not a human" |

Visual iterations along the way: portrait blended into the dark terminal →
switched to ASCII Black Mage; *"mp should be reversed — full mana means we can't
do anything"* (out-of-mana = spent); *"hp is red, mp is blue, exp is yellow"*;
bars overflowed → thinner 8-cell gauges with the % centered on the bar.

## Phase 2 — Honest gauges & WoW direction (2026-06-04 → 06-05)

*"can you engineer something like a World of Warcraft character HUD?"*

| Commit | What shipped |
|---|---|
| `4d27c3fe` `9ed9734e` `d18d6cc8` | Honest % chip — no colored block at low fill; % stays on a bar-colored pill; empty track uses bar color not white |
| `8d7dab0e` | Abbreviate model family (Opus→O, Sonnet→S, Haiku→H) |
| `dc8a76c8` | CI "raid" status, playtime in hours, dropped the FF label |
| `d3b5e76b` `29417589` | Real screenshots in README |

## Phase 3 — EXP leveling & credit burn (2026-06-05)

*"can it show my credits?"* → Gold. *"a week of tokens = 1 level."*

| Commit | What shipped |
|---|---|
| `aba125a7` | EXP leveling — 1 level per week of tokens |
| `a264de91` | EXP bar shows current usage; level banks elapsed weeks |
| `4aefe6b1` `c1f83b73` | Flame-animate the EXP bar during active credit burn + screenshot |
| `176c9cc4` | **Fix level explosion in credits mode** (first sighting of the race) |

## Phase 4 — Boss fights, party, ambient magic (2026-06-05)

*"Boss Fight mode — task lists become a WoW boss with HP = remaining tasks."*

| Commit | What shipped |
|---|---|
| `381197f1` | Boss fight (todos→HP), party/raid, ambient magic |
| `a454f9d7` | Float ambient magic between segments |

## Phase 5 — The two crises (2026-06-05)

Two hard bugs, both rooted in the same place — **concurrency across ~15
sessions**.

- **Level explosion (Lv 160 million).** *"I jumped to level 5… it bugs when EXP
  is always 100%."* Concurrent sessions shared one global level file: same temp
  path → corruption; accumulate-by-`+=` raced. Fixed by deriving the level
  deterministically from the rate-limit `resets_at` delta (`352d705f`,
  `176c9cc4`).
- **Terminal lag (load avg 527).** *"is the statusline causing lag in cmux?"*
  Root causes: ~28 separate `jq` spawns, a `git status` per render, and a boss
  parser slurping the entire multi-MB transcript. Fixed: one combined `jq`,
  backgrounded+cached git, `tail -n 5000` bounded scans, longer TTLs — render
  ~5s → ~0.1s (`dda889d6`, `a0553098`).

| Commit | What shipped |
|---|---|
| `352d705f` | Race-proof level (deterministic, not accumulated) |
| `dda889d6` | Fix terminal lag — one jq, cached git, bounded scans |
| `a0553098` | Default `refreshInterval` 1→3 to cut the render storm |
| `2066715f` | Move weekly-reset cooldown to last on line 2 |

## Phase 6 — Agent-teams boss fights & class chooser (2026-06-05)

| Commit | What shipped |
|---|---|
| `eba854b5` | Boss fight supports Agent-teams `TaskCreate` lists |
| `d8fb5773` | **Lock boss name** for the whole fight (stop it jumping as tasks wobble) |
| `24cc4ed9` | 9-class WoW chooser + boss staleness expiry + casts-at-wand + compact model name |
| `7b482969` | Boss tracks **live task completions** (aggregate latest status per task id) |
| `964287eb` | Running sub-agents shown as the **raid** attacking the boss — *"capture the agent teams on boss fight, showing as raid team"* |

## Phase 7 — Locale: home town vs world exploring (2026-06-06)

*"separate worktree folder and parent folder — parent is in inn or city,
worktree is world exploring."*

| Commit | What shipped |
|---|---|
| `d99b7627` | Merge area+camp into one Locale: 🧭 worktree (exploring) vs 🏠 primary (home) |
| `8cbcde57` | Random per-worktree travel **mount** — 🐎 ⛵ ⛰ 👣 🌲 (stable per name, pure-bash hash) |
| `aca680c2` | Random per-folder town **building** — 🏪 🏨 🏠 ⚒ |
| `992247ab` | RP-style the **Quest**: strip `feat/`·`fix/` prefix, dashes→spaces; detached HEAD → `📜 adrift <sha>` |

---

## Design principles that held throughout

- **No performance impact.** Every render runs on the hot path. Expensive work
  (git, gh, transcript parsing) is backgrounded and stamp-file gated; randomness
  is a fork-free pure-bash hash of a stable key, never `$RANDOM`.
- **Determinism over flicker.** "Random" icons hash a fixed input (worktree /
  folder name) so each gets a stable look — no re-roll every refresh.
- **Race-proof shared state.** Per-PID temp files; levels derived from a
  timestamp, never accumulated, because ~15 sessions write concurrently.
- **bash 3.2 (macOS default).** No associative arrays, no `${var^}`; colors
  carried as literal `\033`, decoded once at print.
