# Claude Code RPG Status Line

A Final Fantasy / WoW-style **character HUD** for the [Claude Code](https://code.claude.com)
status line. Your session becomes a mage: context is your HP, the rate-limit
windows are MP and EXP, session cost is Gil, and an animated Black Mage portrait
blinks at you from the left.

```
▟██▙ 🪄 deathemperor · 🧙 Opus 4.8 · HP ██78%█░░ · MP ██86%██░ · EXP ██84%██░ ⏳ 12h · 🔮 high · ⚔ +406/-397 · 🌀 Focus  🎒 Encumbered
▝••▘ 🏰 banyan · 🪙 22.79 Gil · 🕹 29h26m · ⚑ 3 · 🗺 …/papaya/banyan · 📜 main · ⛺ camp · 📖 «…»
```

- **Line 1 — your character:** portrait · hero · class · vitals (HP/MP/EXP) · spell power · damage · buffs
- **Line 2 — stats & world:** kingdom · Gil · playtime · PRs · area · quest · worktree · tale

All values come from the JSON Claude Code feeds the status line on stdin, plus
`git` and `gh` for the repo/PR bits. No data is invented — every gauge maps to a
real field.

---

## HUD Legend

### Line 1 — your character

| Icon | Name | Meaning | Source |
|------|------|---------|--------|
| `▟██▙` / `▝••▘` | Portrait | Animated Black Mage (shimmers + blinks) | — |
| `🪄` *name* | **Hero** | You (gold = the player) | system user |
| `🧙` *model* | **Class / Job** | The model, in mage class-blue | `model.display_name` |
| `HP` (red) | **Life** | Context window **remaining** — drains as context fills; 0 = compaction | `context_window.remaining_percentage` |
| `MP` (blue) | **Mana** | 5-hour rate-limit left (`100 − used`) — recharges at reset | `rate_limits.five_hour` |
| `EXP` (yellow) `⏳` | **Experience** | 7-day rate-limit usage + countdown to the weekly reset | `rate_limits.seven_day` |
| `🔮` *level* | **Spell power** | Reasoning effort (low/medium/high) | `effort.level` |
| `⚔` `+N/-N` | **Damage dealt** | Lines added / removed this session | `cost.total_lines_*` |
| `🌀 Focus` | **Buff** | Extended thinking is on | `thinking.enabled` |
| `🎒 Encumbered` | **Debuff** | Context over 200k tokens | `exceeds_200k_tokens` |
| `⚡ Haste` | **Buff** | Fast mode is on (only shown when active) | `fast_mode` |

### Line 2 — stats & world

| Icon | Name | Meaning | Source |
|------|------|---------|--------|
| `🏰` *repo* | **Kingdom** | The repository you're questing in | `workspace.repo.name` |
| `🪙` *N* `Gil` | **Gil** | Session cost in USD | `cost.total_cost_usd` |
| `🕹` *N* | **Playtime** | Total session wall-clock | `cost.total_duration_ms` |
| `⚑ N` | **Bounties** | Your open PRs in this repo | `gh` (cached) |
| `🛡 M` | **Trials** | PRs awaiting *your* review (only when > 0) | `gh` (cached) |
| `🗺` *path* | **Area** | Current folder (last 2 path parts) | `cwd` |
| `📜` *branch* | **Quest** | Git branch — a leading `✦` means uncommitted changes | git |
| `⛺` *name* | **Camp** | Active git worktree (a temporary base) | `worktree.name` |
| `📖 «…»` | **Tale** | Session name | `session_name` |

**Conditional segments** (appear only when present): `🎭` agent · `🔧` dev-mode ·
`🎨` output-style · `✏️` vim-mode · `📂` added-dirs.

### Gauges & colors

- Each bar is an 8-cell gauge with the **percentage centered on a chip whose
  background matches the bar color** (dark digits for contrast).
- Colors are fixed RPG convention: **HP = red, MP = blue, EXP = yellow.** The
  hero name is gold; the class is mage class-blue.
- Long text (branch, session name, worktree) is clipped to ~24 chars with `…`
  so the line stays bounded and the compact stats never get pushed off-screen.

---

## Install

1. **Copy the script** to your Claude config dir and make it executable:

   ```bash
   cp claude-statusline/statusline-command.sh ~/.claude/statusline-command.sh
   chmod +x ~/.claude/statusline-command.sh
   ```

2. **Register it** in `~/.claude/settings.json` by merging the `statusLine` block
   from [`settings.snippet.json`](./settings.snippet.json):

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "bash ~/.claude/statusline-command.sh",
       "refreshInterval": 1
     }
   }
   ```

3. Start (or restart) Claude Code. The HUD appears at the bottom.

### `refreshInterval` (the animation)

`refreshInterval: 1` re-runs the script every second so the portrait animates
even while idle. It requires **Claude Code ≥ 2.1.97**. Remove the line to fall
back to event-driven updates (the portrait then only animates while Claude is
working).

---

## Requirements

- **bash** — the script is `bash 3.2`-safe (works with stock macOS bash).
- **`jq`** — parses the status-line JSON (required).
- **truecolor terminal** — colors use 24-bit ANSI (`\033[38;2;r;g;bm`).
- **`git`** — for the quest/branch segment (optional; skipped if absent).
- **`gh`** (GitHub CLI, authenticated) — for the `⚑`/`🛡` PR counts (optional;
  silently skipped if missing). PR data is **cached** in `/tmp` and refreshed in
  the background at most once every 120s, so it never blocks a render.

## Notes & customization

- **Toggle the portrait:** set `SPRITE_ENABLED=0` near the top of the script.
- **Gauge width:** the `W=8` in `render_gauge()`.
- **Segment order / which line:** edit the `l1` (line 1) and `info` (line 2)
  assembly arrays near the bottom.
- **Animation speed/pattern:** the 6-frame `case` block in the sprite section.
- **Runtime cache files** live in `/tmp/claude-statusline-*` (per-session frame
  counter + per-repo PR cache) and are disposable.

## Credits

Built collaboratively with Claude Code. Mage portrait is colored ASCII
(half-block / box-drawing characters), not an image — terminals can't render
real pixel art in the status line.
