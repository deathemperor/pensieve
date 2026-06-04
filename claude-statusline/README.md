# Claude Code RPG Status Line

A Final Fantasy / WoW-style **character HUD** for the [Claude Code](https://code.claude.com)
status line. The session becomes a mage: context is HP, the rate-limit windows
are MP and EXP, session cost is Gold, and an animated Black Mage portrait blinks
from the left.

![Claude Code RPG status line HUD](./hud.png)

Every value comes from the JSON Claude Code feeds the status line on stdin, plus
`git`/`gh` for the repo and PR bits. Nothing is invented — each gauge maps to a
real field.

---

## ⚙️ Install (instructions for a Claude Code agent)

> **You are a Claude Code agent installing this on the user's machine.** Follow
> these steps exactly. Do not overwrite the user's existing `settings.json` —
> merge into it. Run every command yourself; do not ask the user to run them.

### Step 0 — Preconditions

Check required tooling and stop with a clear message if anything required is missing:

```bash
command -v jq   >/dev/null || echo "MISSING: jq (required) — install with 'brew install jq'"
command -v bash >/dev/null || echo "MISSING: bash (required)"
command -v gh   >/dev/null || echo "OPTIONAL: gh not found — the ⚑/🛡 PR segment will be skipped"
```

- `jq` and `bash` are **required**. `bash 3.2` (stock macOS) is fine — the script
  avoids bash-4 features on purpose.
- `gh` (authenticated GitHub CLI) is **optional** (PR counts).
- The terminal must support **truecolor** (24-bit ANSI) for the colors.

### Step 1 — Install the script

Copy the script next to this README into the user's Claude config dir and make
it executable:

```bash
cp claude-statusline/statusline-command.sh ~/.claude/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
```

### Step 2 — Register it in settings.json (merge, never clobber)

Deep-merge the `statusLine` block from `settings.snippet.json` into the user's
existing `~/.claude/settings.json`, preserving all their other keys:

```bash
SETTINGS="$HOME/.claude/settings.json"
SNIPPET="claude-statusline/settings.snippet.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp="$(mktemp)"
jq -s '.[0] * .[1]' "$SETTINGS" "$SNIPPET" > "$tmp" && mv "$tmp" "$SETTINGS"
```

The snippet is:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline-command.sh",
    "refreshInterval": 1
  }
}
```

**Verify the merge produced valid JSON and the key is present:**

```bash
jq -e '.statusLine.command' ~/.claude/settings.json
```

If `jq -e` exits non-zero, the merge failed — restore from the user's git/editor
history and retry; do **not** leave a broken `settings.json`.

### Step 3 — Smoke-test the render

Feed the script a minimal sample of the status-line JSON and confirm it prints
two lines without errors:

```bash
echo '{
  "session_id":"test","cwd":"'"$HOME"'","effort":{"level":"high"},
  "session_name":"Install check","model":{"display_name":"Opus 4.8"},
  "workspace":{"current_dir":"'"$HOME"'","repo":{"owner":"o","name":"demo"}},
  "cost":{"total_cost_usd":1.5,"total_duration_ms":600000,"total_lines_added":10,"total_lines_removed":2},
  "context_window":{"remaining_percentage":67},"exceeds_200k_tokens":false,"thinking":{"enabled":true},
  "rate_limits":{"five_hour":{"used_percentage":20,"resets_at":9999999999},"seven_day":{"used_percentage":40,"resets_at":9999999999}}
}' | bash ~/.claude/statusline-command.sh
```

Expect two ANSI-colored lines (HP/MP/EXP gauges, a `🪄` hero, a Black Mage
portrait). If it errors, check `jq` is installed and the script is `bash`-run.

### Step 4 — Tell the user

Report that the HUD is installed and will appear after they **restart Claude
Code** (or start a new session). Mention the two knobs they're most likely to
want: `SPRITE_ENABLED=0` (drop the portrait) and `refreshInterval` (animation;
see below).

### Idempotency & re-runs

Re-running is safe: Step 1 overwrites the script with the same content, and the
Step 2 `jq` merge just re-sets the same `statusLine` key. Nothing is duplicated.

---

## HUD Legend

### Line 1 — your character

| Icon | Name | Meaning | Source |
|------|------|---------|--------|
| `▟██▙` / `▝••▘` | Portrait | Animated Black Mage (shimmers + blinks) | — |
| `🪄` *name* | **Hero** | The user (gold = the player) | system user |
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
| `🏰` *repo* | **Kingdom** | The repository being worked in | `workspace.repo.name` |
| `💰` *N* `Gold` | **Gold** | Session cost in USD (WoW gold) | `cost.total_cost_usd` |
| `🕹` *N* | **Playtime** | Total session wall-clock | `cost.total_duration_ms` |
| `⚑ N` | **Bounties** | Open PRs authored by the user in this repo | `gh` (cached) |
| `🛡 M` | **Trials** | PRs awaiting the user's review (only when > 0) | `gh` (cached) |
| `🗺` *path* | **Area** | Current folder (last 2 path parts) | `cwd` |
| `📜` *branch* | **Quest** | Git branch — a leading `✦` means uncommitted changes | git |
| `⛺` *name* | **Camp** | Active git worktree (a temporary base) | `worktree.name` |
| `📖 «…»` | **Tale** | Session name | `session_name` |

**Conditional segments** (appear only when present): `🎭` agent · `🔧` dev-mode ·
`🎨` output-style · `✏️` vim-mode · `📂` added-dirs.

### Gauges & colors

- Each bar is an 8-cell gauge with the **percentage centered on a chip whose
  background matches the bar color** (dark digits for contrast).
- Fixed RPG colors: **HP = red, MP = blue, EXP = yellow.** Hero name is gold;
  class is mage class-blue.
- Long text (branch, session name, worktree) is clipped to ~24 chars with `…`
  so the line stays bounded and the compact stats never get pushed off-screen.

---

## `refreshInterval` (the animation)

`refreshInterval: 1` re-runs the script every second so the portrait animates
even while idle. Requires **Claude Code ≥ 2.1.97**. Remove the line to fall back
to event-driven updates (the portrait then only animates while Claude is
working). An agent installing on an older version should drop the
`refreshInterval` key during the Step 2 merge.

## Customization (where to edit in the script)

| Want to change | Edit |
|---|---|
| Disable the portrait | `SPRITE_ENABLED=0` near the top |
| Gauge width | `W=8` in `render_gauge()` |
| Which line a segment is on / order | the `l1` (line 1) and `info` (line 2) arrays near the bottom |
| Animation speed/pattern | the 6-frame `case` block in the sprite section |
| PR cache TTL | the `120` in the "Bounties" block |

Runtime cache files live in `/tmp/claude-statusline-*` (per-session frame
counter + per-repo PR cache) and are disposable.

## Notes for the implementing agent

- The script is **`bash 3.2`-safe** — keep it that way (no associative arrays,
  no `local -n` namerefs). macOS ships bash 3.2.
- Colors are stored as literal `\033` escapes and decoded once by a final
  `printf '%b'`. Follow that convention when adding segments.
- The PR segment shells to `gh` only **at most once per 120 s** in a detached
  background job (gated on a stamp file's mtime), and reads a cached value each
  render — never block the render on the network.
- Bar glyphs are single-width block elements (`█ ░ ▏ ▕`). Avoid ambiguous-width
  glyphs (e.g. `▰ ▱`) — they render double-width / hatched in many fonts and
  overflow the gauge.

## Credits

Built collaboratively with Claude Code. The mage portrait is colored ASCII
(half-block / box-drawing characters), not an image — terminals can't render
real pixel art in the status line.
