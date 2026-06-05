# HUD Build Log

A chronological record of how this RPG character-HUD status line was built —
**every prompt verbatim**, in order, paired with the commit that shipped it.

> This is a hand-curated extract of just the HUD thread. The build happened
> inside a working session that also contained unrelated, confidential work, so
> the raw session transcript is deliberately **not** published (it carries
> proprietary code, infra identifiers, and customer data that must not land in a
> public repo). Only the status-line prompts — all benign game-styling asks —
> are reproduced here.

---

## Phase 1 — Scaffold the RPG HUD · 2026-06-04

> - "improve this to be more game like, like RPG games. usage of final fantasy pixel images are preferred"
> - "find the ANSI version of final fantasy characters"
> - "what's gonna be HP?"
> - "model icon should be a wizard/mage"
> - "it blended in into the dark terminal" *(+ screenshot)*
> - "this is what I see" *(+ screenshot)*
> - "how about ASCII?"
> - "I think mp should be reversed, as full mana now means we can't do anything -> should be out of mana we can't do anything"
> - "or did you get it right already?"
> - "can it show my credits? it can be displayed as ultimate weapon/spell"
> - "the hp, mp, exp bars got overflown" *(+ screenshot)*
> - "mp should be blue"
> - "hp is red, mp is blue, exp is yellow"
> - "be creative about session name for rpg" *(+ screenshot)*
> - "bars look too thick, make it a bit smaller and rpg like, maybe with separators? put percentage on middle of bar to simplify"

Shipped: `c24e20d1` RPG character HUD + legend (HP=context, MP=rate-limit, EXP,
Gold=cost, Black Mage portrait).

## Phase 2 — WoW direction & honest gauges · 2026-06-04

> - "can you engineer something like world of warcraft character hud" *(+ screenshot)*
> - "I thought quest icon is used for branch already?"
> - "⚔ deathemperor the sword is not relevant to a mage, staff/spell maybe?"
> - "time is irrelevant, replace it with something else"
> - "replace the time clock with something else"
> - "status"
> - "anything use full from statusline feed that can be RPGed?"
> - "good work!"
> - "where's the path for the status line setting?"
> - "can these file repo based?"
> - "is session duration on line 2? it wont be rendered on line 2 as line 2 is too long" / "meaning of everything again please" *(+ screenshot)*
> - "playtime has a 🕮 char, you intended it?"
> - "can worktree icon be improve to RPG?"
> - "put damage on first line"
> - "⚔ 🪄 deathemperor, can the ► be removed?"
> - "is there any better wand icon/char?"

Shipped: `4d27c3fe` `9ed9734e` `d18d6cc8` honest % chip; `8d7dab0e` abbreviate
model family; `dc8a76c8` CI raid status, playtime in hours, drop FF label.

## Phase 3 — Repo it & rename Gil→Gold · 2026-06-04

> - "pick this statusline and setting, commit and push on ~/death/pensieve. write a HUD legend in a readme instruction"
> - "changes: - Gil -> Gold (WoW gold) - write the README instructions for another Claude Code to use instead of human"
> - "change the gold icon too"
> - "use this image for screenshot, looks more real" *(+ screenshot)*
> - "I think mp should be reversed..." / "this still bug" *(+ screenshot)*
> - "couldn't see the black mage really" *(+ screenshot)*
> - "mana isn't blue" *(+ screenshot)*
> - "ship it" / "resume" / "not seeing the new shot on git"

Shipped: `c24e20d1`→`1b6d222d` repo + Gil→Gold (💰) + agent-oriented README;
`d3b5e76b` `29417589` real screenshots.

## Phase 4 — EXP leveling & credit burn · 2026-06-05

> - "I jumped to level 5 now, it bugs when my exp is always 100% (in usage credits mode)"
> - "exp: I am over weekly limit now and using per usage, exp bar showing 0% => wrong"
> - "explain the level here for me"
> - "can you animate the exp bar when it's using usage credits? do you know usage credits is being used at all?"
> - "this is what I see flame works" *(+ screenshot)*

Shipped: `aba125a7` EXP leveling (1 level/week of tokens); `a264de91` EXP shows
current usage, level banks weeks; `4aefe6b1` `c1f83b73` flame on active credit
burn; `176c9cc4` first level-explosion fix.

## Phase 5 — Boss fights, party, ambient magic · 2026-06-05

> *(Boss Fight mode requested: task lists become a WoW boss with HP = remaining
> tasks; party/raid = sub-agent count; ambient magic effect.)*

Shipped: `381197f1` boss fight (todos→HP), party/raid, ambient magic;
`a454f9d7` float ambient magic between segments.

## Phase 6 — The two crises · 2026-06-05

> - "is the statusline causing laggy in cmux, investigate"
> - "monitor the load for another minute" *(×2)*
> - "it seems flaky intermittenly like now"
> - "still flaky, can you clean up my cpu?"

Both bugs rooted in **concurrency across ~15 sessions**:

- **Level explosion (Lv 160 million)** — sessions shared one global level file;
  same temp path → corruption, accumulate-by-`+=` raced. Fixed by deriving the
  level deterministically from the rate-limit `resets_at` delta.
- **Terminal lag (load 527)** — ~28 `jq` spawns + a `git status` per render + a
  boss parser slurping the whole multi-MB transcript. Fixed: one combined `jq`,
  backgrounded+cached git, `tail -n 5000` bounded scans. Render ~5s → ~0.1s.

Shipped: `352d705f` race-proof level; `dda889d6` fix lag; `a0553098`
`refreshInterval` 1→3; `2066715f` cooldown last on line 2.

## Phase 7 — Agent-teams boss fights & class chooser · 2026-06-05

> - "now build a class chooser, support the WoW vanilla classes."
> - "the other session with boss fight: now still showing boss mode even long after tasks finish"
> - "the random effect: make it on the place of the wand instead of random position"
> - "compact model name and version: remove space. or can you style it to be RPG somehow"
> - "947.80 Gold => 947.80G"
> - "issue updating boss fight?" *(+ screenshot — boss stuck at 0/6)*
> - "capture the agent teams on boss fight, showing as raid team"

Shipped: `eba854b5` Agent-teams `TaskCreate` lists; `d8fb5773` lock boss name;
`24cc4ed9` 9-class chooser + boss staleness + casts-at-wand + compact;
`7b482969` live task-completion tracking; `964287eb` running sub-agents shown
as the **raid** attacking the boss.

## Phase 8 — Locale & Quest polish · 2026-06-06

> - "worktree can just actually show the last part. actually, separate worktree folder and parent folder. like parent is in inn or city, worktree is world exploring."
> - "propose better icons for exploring"
> - "more options"
> - "well, random between horse, sailboat, mountain, footprints, pine then"
> - "same random for house icon, random between marketplace/inn/home/forge"
> - "improve the quest, like right now it shows \"📜 e915bc5ce\" which means nothing, other place like on branches it should strip feat/ or fix/ to make text more RP"
> - "now extract the transcripts of this session/work and add commit it, this is to record the progress of building the HUD itself."
> - "need a build log with my verbatim prompts"

Shipped: `d99b7627` Locale (🧭 worktree vs 🏠 primary); `8cbcde57` random
per-worktree mount (🐎 ⛵ ⛰ 👣 🌲); `aca680c2` random per-folder building
(🏪 🏨 🏠 ⚒); `992247ab` RP Quest (strip `feat/`·`fix/`, dashes→spaces,
detached HEAD → `📜 adrift <sha>`); `b14a3994` this build log.

---

## Design principles that held throughout

- **No performance impact.** Expensive work (git, gh, transcript parsing) is
  backgrounded and stamp-file gated; randomness is a fork-free pure-bash hash of
  a stable key, never `$RANDOM`.
- **Determinism over flicker.** "Random" icons hash a fixed input (worktree /
  folder name) so each gets a stable look — no re-roll every refresh.
- **Race-proof shared state.** Per-PID temp files; levels derived from a
  timestamp, never accumulated, because ~15 sessions write concurrently.
- **bash 3.2 (macOS default).** No associative arrays, no `${var^}`; colors
  carried as literal `\033`, decoded once at print.
