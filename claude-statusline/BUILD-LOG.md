# HUD Build Log

A chronological record of how this RPG character-HUD status line was built —
**every prompt verbatim**, in order, each followed by what was done and the
commit it shipped in.

---

## Phase 1 — Scaffold the RPG HUD · 2026-06-04

- **"improve this to be more game like, like RPG games. usage of final fantasy pixel images are preferred"** — Built the first HUD: mapped session telemetry to HP/MP/EXP/Gold and drew a pixel portrait.
- **"find the ANSI version of final fantasy characters"** — Produced ANSI/half-block FF-style sprites for the portrait.
- **"what's gonna be HP?"** — Defined HP = remaining context-window %, MP = rate-limit headroom, EXP = 7-day usage.
- **"model icon should be a wizard/mage"** — Swapped the model icon to 🧙.
- **"it blended in into the dark terminal"** *(+ screenshot)* — Brightened portrait colors for contrast on dark terminals.
- **"this is what I see"** *(+ screenshot)* — Diagnosed the actual render and adjusted.
- **"how about ASCII?"** — Replaced the half-block sprite with an ASCII Black Mage (`▟██▙` / `▝••▘`).
- **"I think mp should be reversed, as full mana now means we can't do anything -> should be out of mana we can't do anything"** — Inverted MP so depletion = low mana = can't act.
- **"or did you get it right already?"** — Confirmed the MP direction was now correct.
- **"can it show my credits? it can be displayed as ultimate weapon/spell"** — Added Gold = session cost.
- **"the hp, mp, exp bars got overflown"** *(+ screenshot)* — Fixed overflow by switching to single-width block-element glyphs.
- **"mp should be blue"** — MP bar → blue.
- **"hp is red, mp is blue, exp is yellow"** — Locked the three gauge colors.
- **"be creative about session name for rpg"** *(+ screenshot)* — Styled the session name as a "Tale" `📖 «…»`.
- **"bars look too thick, make it a bit smaller and rpg like, maybe with separators? put percentage on middle of bar to simplify"** — Slimmed to 8-cell gauges with the % centered on the bar.

Shipped in `c24e20d1`.

## Phase 2 — WoW direction & honest gauges · 2026-06-04

- **"can you engineer something like world of warcraft character hud"** *(+ screenshot)* — Reworked the layout into a WoW-style two-line HUD.
- **"I thought quest icon is used for branch already?"** — Kept 📜 for the git branch (Quest), removed the duplicate.
- **"⚔ deathemperor the sword is not relevant to a mage, staff/spell maybe?"** — Replaced the sword with a 🪄 staff/wand for the mage hero.
- **"time is irrelevant, replace it with something else"** / **"replace the time clock with something else"** — Dropped the clock; repurposed the slot to other RPG stats.
- **"status"** — Added a buffs/debuffs status-effects segment.
- **"anything use full from statusline feed that can be RPGed?"** — Added Damage (lines changed), Status effects, Playtime, and Realm/Guild.
- **"good work!"** — (acknowledged.)
- **"where's the path for the status line setting?"** — Pointed to `~/.claude/settings.json` + `statusline-command.sh`.
- **"can these file repo based?"** — Moved the script + settings snippet into a repo.
- **"is session duration on line 2? it wont be rendered on line 2 as line 2 is too long"** / **"meaning of everything again please"** *(+ screenshot)* — Explained the line-2 layout and trimmed it to fit.
- **"playtime has a 🕮 char, you intended it?"** — Fixed the stray glyph → 🕹.
- **"can worktree icon be improve to RPG?"** — Themed the worktree as ⛺ camp.
- **"put damage on first line"** — Moved Damage to line 1.
- **"⚔ 🪄 deathemperor, can the ► be removed?"** — Removed the ► marker.
- **"is there any better wand icon/char?"** — Evaluated alternatives; kept 🪄.

Shipped in `4d27c3fe` `9ed9734e` `d18d6cc8` `8d7dab0e` `dc8a76c8`.

## Phase 3 — Repo it & rename Gil→Gold · 2026-06-04

- **"pick this statusline and setting, commit and push on ~/death/pensieve. write a HUD legend in a readme instruction"** — Committed the script + settings to pensieve with a README legend.
- **"changes: - Gil -> Gold (WoW gold) - write the README instructions for another Claude Code to use instead of human"** — Renamed Gil→Gold; rewrote the README as agent-oriented install + legend.
- **"change the gold icon too"** — Switched the Gold icon to 💰.
- **"use this image for screenshot, looks more real"** *(+ screenshot)* — Replaced the README screenshot with the supplied image.
- **"I think mp should be reversed..."** / **"this still bug"** *(+ screenshot)* — Re-fixed the MP rendering bug spotted in the screenshot.
- **"couldn't see the black mage really"** *(+ screenshot)* — Boosted portrait contrast/brightness.
- **"mana isn't blue"** *(+ screenshot)* — Fixed the MP bar to actually render blue.
- **"ship it"** / **"resume"** / **"not seeing the new shot on git"** — Committed + pushed; re-added the screenshot that hadn't landed.

Shipped in `1b6d222d` `d3b5e76b` `29417589`.

## Phase 4 — EXP leveling & credit burn · 2026-06-05

- **"I jumped to level 5 now, it bugs when my exp is always 100% (in usage credits mode)"** — Diagnosed EXP pinned at 100% in credit mode; reworked the EXP source.
- **"exp: I am over weekly limit now and using per usage, exp bar showing 0% => wrong"** — Fixed EXP to reflect current usage when over the weekly cap.
- **"explain the level here for me"** — Explained the weekly-token leveling model (1 level per week of tokens, banked).
- **"can you animate the exp bar when it's using usage credits? do you know usage credits is being used at all?"** — Added a flame animation on active credit burn and detection of credit usage.
- **"this is what I see flame works"** *(+ screenshot)* — Confirmed the flame from the screenshot.

Shipped in `aba125a7` `a264de91` `4aefe6b1` `c1f83b73` `176c9cc4`.

## Phase 5 — Boss fights, party, ambient magic · 2026-06-05

- **Boss Fight mode** *(requested: task lists become a WoW boss with HP = remaining tasks; party/raid = sub-agent count; an ambient magic effect)* — Implemented all three.

Shipped in `381197f1` `a454f9d7`.

## Phase 6 — The two crises · 2026-06-05

- **"is the statusline causing laggy in cmux, investigate"** — Investigated; found ~28 `jq` spawns + a `git status` per render + a boss parser slurping the whole multi-MB transcript.
- **"monitor the load for another minute"** *(×2)* — Ran background load monitors and confirmed the trend.
- **"it seems flaky intermittenly like now"** — Isolated the cause to background-job pileup.
- **"still flaky, can you clean up my cpu?"** — Killed runaway non-statusline processes (`bfs`, `osemgrep`); declined to kill your own apps (Xcode/Sim/Chrome) without consent.

Outcome: one combined `jq`, backgrounded + cached git, `tail -n 5000` bounded
scans, longer TTLs → render ~5s → ~0.1s, load 527 → stable. Separately,
race-proofed the level (deterministic from `resets_at`, not accumulated) after
~15 concurrent sessions corrupted a shared level file (Lv 160 million).

Shipped in `352d705f` `dda889d6` `a0553098` `2066715f`.

## Phase 7 — Agent-teams boss fights & class chooser · 2026-06-05

- **"now build a class chooser, support the WoW vanilla classes."** — Built `statusline-class.sh` with the 9 vanilla classes + per-class icon/color rendering.
- **"the other session with boss fight: now still showing boss mode even long after tasks finish"** — Added boss-fight staleness expiry (clears after 15 min of no task updates).
- **"the random effect: make it on the place of the wand instead of random position"** — Moved the ambient magic to render at the wand instead of a random slot.
- **"compact model name and version: remove space. or can you style it to be RPG somehow"** — Compacted to `🧙 O4.8` (no space).
- **"947.80 Gold => 947.80G"** — Shortened the Gold format to `NG`.
- **"issue updating boss fight?"** *(+ screenshot — boss stuck at 0/6)* — Fixed boss showing 0/N by aggregating the latest status per task id (completions arrive via `TaskUpdate`, no subject).
- **"capture the agent teams on boss fight, showing as raid team"** — Showed the running sub-agents as `🚩 Raid(N)` attacking the boss, folded into the same slurp.

Shipped in `eba854b5` `d8fb5773` `24cc4ed9` `7b482969` `964287eb`.

## Phase 8 — Locale & Quest polish · 2026-06-06

- **"worktree can just actually show the last part. actually, separate worktree folder and parent folder. like parent is in inn or city, worktree is world exploring."** — Merged the area + camp segments into one context-aware Locale: 🧭 worktree (exploring) vs 🏠 primary checkout (home town).
- **"propose better icons for exploring"** — Proposed a set of explore-icon options.
- **"more options"** — Gave a fuller grouped menu (navigation / terrain / journey).
- **"well, random between horse, sailboat, mountain, footprints, pine then"** — Random per-worktree travel mount 🐎 ⛵ ⛰ 👣 🌲 (stable per name, fork-free hash).
- **"same random for house icon, random between marketplace/inn/home/forge"** — Random per-folder town building 🏪 🏨 🏠 ⚒.
- **"improve the quest, like right now it shows \"📜 e915bc5ce\" which means nothing, other place like on branches it should strip feat/ or fix/ to make text more RP"** — Stripped the git-flow prefix and turned dashes→spaces (`feat/claim-intake` → `claim intake`); detached HEAD → `📜 adrift <sha>`.
- **"now extract the transcripts of this session/work and add commit it, this is to record the progress of building the HUD itself."** — Added this `BUILD-LOG.md` (the raw transcript was not published — see note below).
- **"need a build log with my verbatim prompts"** — Rewrote the log to quote every prompt verbatim.
- **"how about a summary of your work/outcome for each of my prompts?"** — Restructured into this per-prompt outcome format.

Shipped in `d99b7627` `8cbcde57` `aca680c2` `992247ab` `b14a3994` (+ this rewrite).

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
