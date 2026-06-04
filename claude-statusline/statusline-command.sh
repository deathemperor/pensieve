#!/usr/bin/env bash
# Claude Code status line — Final Fantasy / WoW-style character HUD
# Line 1 — hero + vitals:  [portrait] 🪄 <name> · 🧙 class · HP · MP · EXP · 🔮 power · ⚔ dmg · buffs
# Line 2 — world/stats:    [portrait] 🏰 kingdom · 💰 Gold · 🕹 playtime · ⚑ PRs · 🗺 area · 📜 quest · ⛺ camp · 📖 tale
#
# A statusline is text + ANSI only. The portrait on the left is colored ASCII
# (an animated Black Mage). Bars are slim gauges with the % centered on a
# bar-colored chip.
#
# bash 3.2 SAFE: no associative arrays, no namerefs. Colors are stored as
# literal \033 and decoded once by the final `printf '%b'`.

input=$(cat)

# Debug: save the latest input so we can inspect missing fields.
printf '%s' "$input" > /tmp/claude-statusline-input.json 2>/dev/null

# Toggle the portrait sprite (1=on, 0=off) — turn off for narrow terminals / SSH.
SPRITE_ENABLED=1

# --- RPG gauge: slim 8-cell bar with the % centered inside it. -------------
#   ██76%██░   filled = bar color, empty = dim, % = dark digits on a chip whose
# BACKGROUND matches the bar color. No frame chars (keeps vertical lines down).
# Glyphs █ ░ are single-width block elements (the ▰/▱ parallelograms overflowed).
# $1 = pct (0-100), $2 = bar color as "R;G;B".
render_gauge() {
  local pct=$1 rgb=$2
  if [ "$pct" -gt 100 ]; then pct=100; fi
  if [ "$pct" -lt 0 ]; then pct=0; fi
  local W=8
  local filled=$(( (pct * W + 50) / 100 ))   # rounded
  local label="${pct}%"
  local llen=${#label}
  local start=$(( (W - llen) / 2 ))
  local fill="\033[38;2;${rgb}m"                            # filled cells
  local chip="\033[48;2;${rgb}m\033[1m\033[38;2;25;25;35m"  # % label pill: solid bar-colored bg, dark digits
  local dim='\033[38;2;95;95;115m'                          # empty track
  local rst='\033[0m'
  local out="" i off ch
  for ((i=0; i<W; i++)); do
    if [ "$i" -ge "$start" ] && [ "$i" -lt $(( start + llen )) ]; then
      # The % is a solid label pill — always on a bar-colored background so it
      # reads as one chip, never split across the fill boundary.
      off=$(( i - start )); ch="${label:off:1}"
      out="${out}${chip}${ch}${rst}"
    elif [ "$i" -lt "$filled" ]; then
      out="${out}${fill}█${rst}"
    else
      out="${out}${dim}░${rst}"
    fi
  done
  printf '%s' "$out"
}

# --- Portrait sprite (FF Black Mage — hooded figure, animated) -------------
#   ▟██▙   hood        ▝••▘   glowing eyes (shimmer + blink)
HOOD='130;122;235'   # bright indigo hood
SHADE='80;74;180'    # darker indigo (eye sockets / shadow)
EYES='250;215;75'    # glowing yellow eyes (bright)
sprite_l1=""
sprite_l2=""
if [ "$SPRITE_ENABLED" = "1" ]; then
  # Advance a per-session frame counter once per render. 6-frame cycle tuned for
  # the 1 fps idle floor (refreshInterval=1) so the eyes change every second.
  sid=$(echo "$input" | jq -r '.session_id // "x"')
  frame_file="/tmp/claude-statusline-frame-${sid}"
  frame=$(cat "$frame_file" 2>/dev/null)
  case "$frame" in ''|*[!0-9]*) frame=0 ;; esac
  echo $(( (frame + 1) % 6 )) > "$frame_file" 2>/dev/null
  case "$frame" in
    0|4) eye="$EYES"        ;; # bright
    1|3) eye='220;185;55'   ;; # normal
    2)   eye='150;125;45'   ;; # dim
    5)   eye="$SHADE"       ;; # blink — eyes closed
  esac
  sprite_l1="\033[38;2;${HOOD}m▟██▙\033[0m "
  sprite_l2="\033[38;2;${SHADE}m▝\033[38;2;${eye}m••\033[38;2;${SHADE}m▘\033[0m "
fi

# Clip a string to a max display length (keeps line widths bounded so the
# compact stats on line 2 don't get pushed off the right edge).
clip() {
  local s=$1 m=$2
  if [ "${#s}" -gt "$m" ]; then printf '%s…' "${s:0:$((m-1))}"; else printf '%s' "$s"; fi
}

# ===========================================================================
# SEGMENTS — each computed into a variable / the vitals array, then assembled
# into two lines (vitals+hero / context) in proper RPG order at the end.
# ===========================================================================

# --- Hero (user) — gold name, preceded by the ► battle cursor ---
user=$(whoami)
hero="\033[38;2;255;209;0m🪄 ${user}\033[0m"

# --- Vitals (HP / MP / EXP) → line 1, left of the name ---
vitals=()

# HP — context window; life DRAINS as context fills (0 = compaction). Always red.
remain=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
if [ -n "$remain" ]; then
  hp_int=${remain%.*}
  vitals+=("\033[38;2;255;85;85mHP\033[0m $(render_gauge "$hp_int" '255;85;85')")
else
  vitals+=("\033[90mHP ░░░░░░░░ --\033[0m")
fi

# MP — 5-hour window; mana you spend, recharges at reset. Always blue.
five_used=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
if [ -n "$five_used" ]; then
  five_used_int=${five_used%.*}
  mp_avail=$(( 100 - five_used_int ))   # MANA LEFT = full bar good
  vitals+=("\033[38;2;59;158;255mMP\033[0m $(render_gauge "$mp_avail" '59;158;255')")
else
  vitals+=("\033[90mMP ░░░░░░░░ --\033[0m")
fi

# EXP — 7-day window; progress toward the weekly reset. Always yellow.
week_resets_at=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
week_used=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
if [ -n "$week_resets_at" ] && [ -n "$week_used" ]; then
  now=$(date +%s)
  secs_left=$(( week_resets_at - now ))
  [ "$secs_left" -lt 0 ] && secs_left=0
  days_left=$(( secs_left / 86400 ))
  if [ "$days_left" -ge 1 ]; then
    time_str="⏳ ${days_left}d"
  else
    time_str="⏳ $(( secs_left / 3600 ))h"
  fi
  week_used_int=${week_used%.*}
  # Countdown to the weekly "level-up" reset — bold bright-gold so it pops.
  vitals+=("\033[38;2;245;205;65mEXP\033[0m $(render_gauge "$week_used_int" '245;205;65') \033[1m\033[38;2;255;220;90m${time_str}\033[0m")
else
  vitals+=("\033[90mEXP ░░░░░░░░ --\033[0m")
fi

# --- Context segments → line 2 ---

# Class / Job (model) — mage class color (WoW mage blue)
seg_class=""
# Strip the trailing "(…)" then abbreviate the family: Opus→O, Sonnet→S, Haiku→H.
model=$(echo "$input" | jq -r '.model.display_name // empty' \
  | sed -E 's/[[:space:]]*\([^)]*\)[[:space:]]*$//' \
  | sed -E 's/^Opus /O /; s/^Sonnet /S /; s/^Haiku /H /')
[ -n "$model" ] && seg_class="\033[38;2;63;199;235m🧙 ${model}\033[0m"

# Area / zone (CWD) — last 2 path components
seg_area=""
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
if [ -n "$cwd" ]; then
  short_cwd="${cwd/#$HOME/~}"
  dir_display=$(echo "$short_cwd" | awk -F'/' '{ n=NF; if (n<=2){print $0} else {print "…/" $(n-1) "/" $n} }')
  seg_area="\033[33m🗺 ${dir_display}\033[0m"
fi

# Quest (git branch) + dirty marker
seg_quest=""
if [ -n "$cwd" ]; then
  branch=$(git --no-optional-locks -C "$cwd" symbolic-ref --short HEAD 2>/dev/null \
    || git --no-optional-locks -C "$cwd" rev-parse --short HEAD 2>/dev/null)
fi
if [ -n "$branch" ]; then
  dirty=$(git --no-optional-locks -C "$cwd" status --porcelain 2>/dev/null | head -1)
  br=$(clip "$branch" 24)
  if [ -n "$dirty" ]; then
    seg_quest="\033[34m\033[33m✦\033[34m 📜 ${br}\033[0m"
  else
    seg_quest="\033[34m📜 ${br}\033[0m"
  fi
fi

# Worldmap node (worktree)
seg_worktree=""
worktree_name=$(echo "$input" | jq -r '.worktree.name // empty')
[ -n "$worktree_name" ] && seg_worktree="\033[34m⛺ $(clip "$worktree_name" 20)\033[0m"

# Tale / chapter (session name)
seg_tale=""
session_name=$(echo "$input" | jq -r '.session_name // empty')
[ -n "$session_name" ] && seg_tale="\033[38;2;230;200;120m📖 «$(clip "$session_name" 24)»\033[0m"

# Spell power (reasoning effort)
seg_power=""
effort=$(echo "$input" | jq -r '.effort.level // empty')
[ -n "$effort" ] && seg_power="\033[35m🔮 ${effort}\033[0m"

# Gold (session cost)
seg_gil=""
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
if [ -n "$cost_usd" ]; then
  cost_fmt=$(printf '%.2f' "$cost_usd" 2>/dev/null || echo "$cost_usd")
  seg_gil="\033[38;2;245;205;65m💰 ${cost_fmt} Gold\033[0m"
fi

# Companion (agent)
seg_agent=""
agent_name=$(echo "$input" | jq -r '.agent.name // empty')
[ -n "$agent_name" ] && seg_agent="\033[35m🎭 ${agent_name}\033[0m"

# Realm (dev mode)
seg_realm=""
project_dir=$(echo "$input" | jq -r '.workspace.project_dir // empty')
if [ -n "$project_dir" ]; then
  dev_mode=$(cat "${project_dir}/.claude/.dev-mode" 2>/dev/null | tr -d '[:space:]')
  [ -n "$dev_mode" ] && seg_realm="\033[35m🔧 ${dev_mode}\033[0m"
fi

# Output style (only when non-default)
seg_style=""
output_style=$(echo "$input" | jq -r '.output_style.name // empty')
[ -n "$output_style" ] && [ "$output_style" != "default" ] && seg_style="\033[35m🎨 ${output_style}\033[0m"

# Vim mode
seg_vim=""
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')
if [ -n "$vim_mode" ]; then
  if [ "$vim_mode" = "INSERT" ]; then vim_color="\033[32m"; else vim_color="\033[33m"; fi
  seg_vim="${vim_color}✏️  ${vim_mode}\033[0m"
fi

# Added dirs
seg_added=""
added_dirs=$(echo "$input" | jq -r '.workspace.added_dirs[]? // empty' 2>/dev/null)
if [ -n "$added_dirs" ]; then
  added_count=$(echo "$added_dirs" | wc -l | tr -d ' ')
  seg_added="\033[37m📂 +${added_count}\033[0m"
fi

# Damage dealt (lines added / removed this session) — combat output
seg_dmg=""
added=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
removed=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')
if [ "$added" != "0" ] || [ "$removed" != "0" ]; then
  seg_dmg="\033[38;2;255;140;60m⚔ +${added}/-${removed}\033[0m"
fi

# Playtime (total session wall-clock) — the RPG save-file stat
seg_play=""
dur_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // empty')
if [ -n "$dur_ms" ] && [ "$dur_ms" -gt 0 ] 2>/dev/null; then
  total_min=$(( dur_ms / 60000 ))
  ph=$(( total_min / 60 )); pm=$(( total_min % 60 ))
  if [ "$ph" -ge 1 ]; then play_str="${ph}h${pm}m"; else play_str="${pm}m"; fi
  seg_play="\033[38;2;180;180;200m🕹 ${play_str}\033[0m"
fi

# Kingdom (repo) — the realm you're questing in
seg_kingdom=""
repo_name=$(echo "$input" | jq -r '.workspace.repo.name // empty')
repo_owner=$(echo "$input" | jq -r '.workspace.repo.owner // empty')
[ -n "$repo_name" ] && seg_kingdom="\033[38;2;200;170;120m🏰 ${repo_name}\033[0m"

# Bounties (open PRs) — ⚑ mine, 🛡 awaiting my review. gh is ~1s/call, so this
# is CACHED: read the value instantly each render; refresh in the background at
# most once per TTL (the stamp-file mtime gates respawns).
seg_pr=""
if [ -n "$repo_owner" ] && [ -n "$repo_name" ] && command -v gh >/dev/null 2>&1; then
  pr_key=$(printf '%s_%s' "$repo_owner" "$repo_name" | tr -c 'A-Za-z0-9_' '_')
  pr_val="/tmp/claude-statusline-prs-${pr_key}.val"
  pr_stamp="/tmp/claude-statusline-prs-${pr_key}.stamp"
  pr_now=$(date +%s)
  pr_stamp_m=$(stat -f %m "$pr_stamp" 2>/dev/null || echo 0)
  if [ $(( pr_now - pr_stamp_m )) -ge 120 ]; then
    : > "$pr_stamp"   # mark the attempt now so we spawn once per TTL, not per render
    ( mine=$(gh pr list -R "${repo_owner}/${repo_name}" --author @me --state open --json number --jq 'length' 2>/dev/null)
      revs=$(gh pr list -R "${repo_owner}/${repo_name}" --search "review-requested:@me" --state open --json number --jq 'length' 2>/dev/null)
      printf '%s %s' "${mine:-0}" "${revs:-0}" > "${pr_val}.tmp" 2>/dev/null && mv "${pr_val}.tmp" "$pr_val" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$pr_val" ]; then
    read pr_mine pr_revs < "$pr_val"
    seg_pr="\033[38;2;120;200;120m⚑ ${pr_mine:-0}\033[0m"
    [ "${pr_revs:-0}" != "0" ] && seg_pr="${seg_pr} \033[38;2;235;180;90m🛡 ${pr_revs}\033[0m"
  fi
fi

# Status effects (buffs/debuffs) — each shows only when its flag is true
seg_status=""
thinking_on=$(echo "$input" | jq -r '.thinking.enabled // false')
heavy=$(echo "$input" | jq -r '.exceeds_200k_tokens // false')
fast_on=$(echo "$input" | jq -r '.fast_mode // false')
[ "$thinking_on" = "true" ] && seg_status="\033[38;2;120;230;180m🌀 Focus\033[0m"
if [ "$heavy" = "true" ]; then
  [ -n "$seg_status" ] && seg_status="${seg_status}  "
  seg_status="${seg_status}\033[38;2;255;140;60m🎒 Encumbered\033[0m"
fi
if [ "$fast_on" = "true" ]; then
  [ -n "$seg_status" ] && seg_status="${seg_status}  "
  seg_status="${seg_status}\033[38;2;255;215;70m⚡ Haste\033[0m"
fi

# --- Join helper (separator passed in) ---
join_with() {
  local s=$1; shift
  local out="" p
  for p in "$@"; do
    if [ -z "$out" ]; then out="$p"; else out="${out}${s}${p}"; fi
  done
  printf '%s' "$out"
}

sep=" \033[90m·\033[0m "               # dim middle dot — minimal vertical lines

# Line 1 — identity (name, class), vitals, spell power, then active buffs/debuffs.
l1=("$hero")
[ -n "$seg_class" ] && l1+=("$seg_class")
l1+=("${vitals[@]}")
[ -n "$seg_power" ] && l1+=("$seg_power")
[ -n "$seg_dmg" ] && l1+=("$seg_dmg")
[ -n "$seg_status" ] && l1+=("$seg_status")

# Line 2 — world/context + session stats in RPG order, skipping empty segments.
info=()
for s in "$seg_kingdom" "$seg_gil" "$seg_play" "$seg_pr" \
         "$seg_area" "$seg_quest" "$seg_worktree" "$seg_tale" \
         "$seg_agent" "$seg_realm" "$seg_style" "$seg_vim" "$seg_added"; do
  [ -n "$s" ] && info+=("$s")
done

line1="${sprite_l1}$(join_with "$sep" "${l1[@]}")"
line2="${sprite_l2}$(join_with "$sep" "${info[@]}")"

# Print both lines (only emit line 2 if it has content beyond the sprite).
if [ -n "$line2" ]; then
  printf '%b\n%b\n' "$line1" "$line2"
else
  printf '%b\n' "$line1"
fi
