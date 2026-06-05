# HUD Build Log

How this RPG character-HUD status line was built — **every prompt verbatim**, in
order, paired with what it produced. Each phase ends with the commits it shipped.

---

## Phase 1 — Scaffold the RPG HUD · 2026-06-04

| Prompt | What was built |
|---|---|
| "improve this to be more game like, like RPG games. usage of final fantasy pixel images are preferred" | First HUD: session telemetry mapped to HP/MP/EXP/Gold + a pixel portrait |
| "find the ANSI version of final fantasy characters" | ANSI / half-block FF-style sprites for the portrait |
| "what's gonna be HP?" | HP = remaining context %, MP = rate-limit headroom, EXP = 7-day usage |
| "model icon should be a wizard/mage" | Model icon → 🧙 |
| "it blended in into the dark terminal" *(+ shot)* | Brightened portrait colors for dark terminals |
| "this is what I see" *(+ shot)* | Diagnosed the real render and adjusted |
| "how about ASCII?" | ASCII Black Mage (`▟██▙` / `▝••▘`) |
| "I think mp should be reversed … out of mana we can't do anything" | Inverted MP: depletion = can't act |
| "or did you get it right already?" | Confirmed MP direction was correct |
| "can it show my credits? … ultimate weapon/spell" | Gold = session cost |
| "the hp, mp, exp bars got overflown" *(+ shot)* | Fixed overflow with single-width block glyphs |
| "mp should be blue" | MP bar → blue |
| "hp is red, mp is blue, exp is yellow" | Locked the three gauge colors |
| "be creative about session name for rpg" *(+ shot)* | Session name styled as a "Tale" `📖 «…»` |
| "bars look too thick … put percentage on middle of bar" | 8-cell gauges, % centered on the bar |

**Shipped:** `c24e20d1`

## Phase 2 — WoW direction & honest gauges · 2026-06-04

| Prompt | What was built |
|---|---|
| "can you engineer something like world of warcraft character hud" *(+ shot)* | WoW-style two-line HUD layout |
| "I thought quest icon is used for branch already?" | Kept 📜 for the branch (Quest); removed the duplicate |
| "⚔ … the sword is not relevant to a mage, staff/spell maybe?" | Sword → 🪄 staff/wand |
| "time is irrelevant, replace it" / "replace the time clock" | Dropped the clock; slot repurposed |
| "status" | Buffs/debuffs status-effects segment |
| "anything use full from statusline feed that can be RPGed?" | Added Damage, Status effects, Playtime, Realm/Guild |
| "good work!" | — |
| "where's the path for the status line setting?" | `~/.claude/settings.json` + `statusline-command.sh` |
| "can these file repo based?" | Moved script + settings into a repo |
| "is session duration on line 2? … too long" / "meaning of everything again" *(+ shot)* | Explained line-2 layout; trimmed to fit |
| "playtime has a 🕮 char, you intended it?" | Stray glyph → 🕹 |
| "can worktree icon be improve to RPG?" | Worktree → ⛺ camp |
| "put damage on first line" | Damage moved to line 1 |
| "⚔ 🪄 deathemperor, can the ► be removed?" | Removed the ► marker |
| "is there any better wand icon/char?" | Evaluated; kept 🪄 |

**Shipped:** `4d27c3fe` `9ed9734e` `d18d6cc8` `8d7dab0e` `dc8a76c8`

## Phase 3 — Repo it & rename Gil→Gold · 2026-06-04

| Prompt | What was built |
|---|---|
| "pick this statusline and setting, commit and push on ~/death/pensieve. write a HUD legend in a readme" | Committed to pensieve with a README legend |
| "Gil -> Gold (WoW gold) … README for another Claude Code instead of human" | Renamed Gil→Gold; agent-oriented README |
| "change the gold icon too" | Gold icon → 💰 |
| "use this image for screenshot, looks more real" *(+ shot)* | Swapped in the supplied screenshot |
| "I think mp should be reversed…" / "this still bug" *(+ shot)* | Re-fixed the MP render bug |
| "couldn't see the black mage really" *(+ shot)* | Boosted portrait contrast |
| "mana isn't blue" *(+ shot)* | MP bar → actually blue |
| "ship it" / "resume" / "not seeing the new shot on git" | Pushed; re-added the missing screenshot |

**Shipped:** `1b6d222d` `d3b5e76b` `29417589`

## Phase 4 — EXP leveling & credit burn · 2026-06-05

| Prompt | What was built |
|---|---|
| "I jumped to level 5 … bugs when my exp is always 100% (usage credits mode)" | Reworked the EXP source (was pinned at 100%) |
| "exp: over weekly limit … exp bar showing 0% => wrong" | EXP reflects current usage past the weekly cap |
| "explain the level here for me" | Explained the weekly-token leveling model |
| "can you animate the exp bar … do you know usage credits is being used?" | Flame animation on active credit burn + usage detection |
| "this is what I see flame works" *(+ shot)* | Confirmed the flame |

**Shipped:** `aba125a7` `a264de91` `4aefe6b1` `c1f83b73` `176c9cc4`

## Phase 5 — Boss fights, party, ambient magic · 2026-06-05

| Prompt | What was built |
|---|---|
| Boss Fight mode *(task lists → WoW boss, HP = remaining tasks; party/raid = sub-agents; ambient magic)* | Implemented all three |

**Shipped:** `381197f1` `a454f9d7`

## Phase 6 — The two crises · 2026-06-05

| Prompt | What was built |
|---|---|
| "is the statusline causing laggy in cmux, investigate" | Found ~28 `jq` spawns + per-render `git status` + whole-transcript slurp |
| "monitor the load for another minute" *(×2)* | Background load monitors; confirmed the trend |
| "it seems flaky intermittenly like now" | Isolated background-job pileup |
| "still flaky, can you clean up my cpu?" | Killed runaway `bfs`/`osemgrep`; declined to kill your apps without consent |

**Outcome:** one combined `jq`, backgrounded + cached git, `tail -n 5000` bounded
scans → render ~5s → ~0.1s, load 527 → stable. Also race-proofed the level
(deterministic from `resets_at`, not accumulated) after ~15 concurrent sessions
corrupted a shared level file (Lv 160 million).

**Shipped:** `352d705f` `dda889d6` `a0553098` `2066715f`

## Phase 7 — Agent-teams boss fights & class chooser · 2026-06-05

| Prompt | What was built |
|---|---|
| "now build a class chooser, support the WoW vanilla classes." | `statusline-class.sh` — 9 vanilla classes, per-class icon/color |
| "boss fight: still showing boss mode even long after tasks finish" | Boss staleness expiry (clears after 15 min idle) |
| "the random effect: make it on the place of the wand instead of random position" | Ambient magic renders at the wand |
| "compact model name and version: remove space …" | Compacted to `🧙 O4.8` |
| "947.80 Gold => 947.80G" | Gold format shortened to `NG` |
| "issue updating boss fight?" *(+ shot — stuck at 0/6)* | Aggregate latest status per task id (track `TaskUpdate` completions) |
| "capture the agent teams on boss fight, showing as raid team" | Running sub-agents shown as `🚩 Raid(N)` on the boss |

**Shipped:** `eba854b5` `d8fb5773` `24cc4ed9` `7b482969` `964287eb`

## Phase 8 — Locale & Quest polish · 2026-06-06

| Prompt | What was built |
|---|---|
| "separate worktree folder and parent folder … parent is in inn or city, worktree is world exploring" | One Locale segment: 🧭 worktree (exploring) vs 🏠 primary (home) |
| "propose better icons for exploring" | Proposed explore-icon options |
| "more options" | Fuller grouped menu (navigation / terrain / journey) |
| "well, random between horse, sailboat, mountain, footprints, pine then" | Random per-worktree mount 🐎 ⛵ ⛰ 👣 🌲 (fork-free hash) |
| "same random for house icon, random between marketplace/inn/home/forge" | Random per-folder building 🏪 🏨 🏠 ⚒ |
| "improve the quest … strip feat/ or fix/ to make text more RP" | Strip git-flow prefix, dashes→spaces; detached HEAD → `📜 adrift <sha>` |
| "extract the transcripts … record the progress of building the HUD" | Added this `BUILD-LOG.md` |
| "need a build log with my verbatim prompts" | Quoted every prompt verbatim |
| "how about a summary of your work/outcome for each of my prompts?" | Paired each prompt with its outcome |
| "structure the prompts and what you build for easier of read" | Reformatted into these per-phase tables |

**Shipped:** `d99b7627` `8cbcde57` `aca680c2` `992247ab` `b14a3994` `ae71b2c8` (+ this rewrite)

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
