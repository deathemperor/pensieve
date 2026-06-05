#!/usr/bin/env bash
# Claude Code status line — WoW-style RPG character HUD
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
  local fill="\033[38;2;${rgb}m"                              # filled cells
  local chip_on="\033[48;2;${rgb}m\033[1m\033[38;2;25;25;35m"      # digit OVER filled: dark on bar color
  local chip_off="\033[48;2;60;60;78m\033[1m\033[38;2;${rgb}m"      # digit OVER empty: bar-colored on dim track
  local dim='\033[38;2;95;95;115m'                            # empty track
  local rst='\033[0m'
  local out="" i off ch
  for ((i=0; i<W; i++)); do
    if [ "$i" -ge "$start" ] && [ "$i" -lt $(( start + llen )) ]; then
      # The % digit sits on the bar's ACTUAL state at this cell: bar-color where
      # filled, dim track where empty. Honest about fill (low % no longer shows a
      # big colored block) and always a solid background (never bare terminal dark).
      off=$(( i - start )); ch="${label:off:1}"
      if [ "$i" -lt "$filled" ]; then
        out="${out}${chip_on}${ch}${rst}"
      else
        out="${out}${chip_off}${ch}${rst}"
      fi
    elif [ "$i" -lt "$filled" ]; then
      out="${out}${fill}█${rst}"
    else
      out="${out}${dim}░${rst}"
    fi
  done
  printf '%s' "$out"
}

# --- Portrait sprite (Black Mage — hooded figure, animated) ----------------
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

# EXP / Level — the BAR shows your current 7-day quota usage (reads 100, never
# 0, even when maxed/over the weekly limit). The LEVEL banks one week each time
# the 7-day window actually ROLLS OVER — detected by seven_day.resets_at
# advancing, NOT by usage drops (usage is noisy in credits mode and would bank
# phantom weeks). At a real rollover the just-ended week's usage is added to a
# persistent total in ~/.claude/.statusline-level (survives reboots). Level =
# banked / 100 + 1, so ~one full week of tokens = 1 level. Sampling gated to 30s.
# File format: "bank last_reset_at last_used ts".
week_used=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // 0')
if [ -n "$week_used" ]; then
  cur_pct=${week_used%.*}
  [ "$cur_pct" -gt 100 ] 2>/dev/null && cur_pct=100
  case "$week_reset" in ''|*[!0-9]*) week_reset=0 ;; esac
  lvl_file="$HOME/.claude/.statusline-level"
  read lvl_bank lvl_lra lvl_lu lvl_ts < "$lvl_file" 2>/dev/null
  case "$lvl_bank" in ''|*[!0-9]*) lvl_bank=0 ;; esac
  case "$lvl_lra"  in ''|*[!0-9]*) lvl_lra=0  ;; esac
  case "$lvl_lu"   in ''|*[!0-9]*) lvl_lu=0   ;; esac
  case "$lvl_ts"   in ''|*[!0-9]*) lvl_ts=0   ;; esac
  # Self-heal corrupt / old-format state: lu is a 0–100 percentage; lra is an
  # epoch (~1.7e9); bank can't realistically exceed ~1000 levels (100000 pts).
  # Without this, an old 3-field file ("bank last ts") misaligns into 4 vars and
  # banks an epoch-sized value every render → the level explodes.
  [ "$lvl_lu"   -gt 100 ] && lvl_lu=0
  [ "$lvl_lra"  -lt 1000000000 ] && lvl_lra=0
  [ "$lvl_bank" -gt 100000 ] && lvl_bank=0
  lvl_now=$(date +%s)
  if [ $(( lvl_now - lvl_ts )) -ge 30 ]; then
    # bank a week ONLY when the window truly rolled over (resets_at advanced)
    if [ "$lvl_lra" -ne 0 ] && [ "$week_reset" -gt "$lvl_lra" ]; then
      lvl_bank=$(( lvl_bank + lvl_lu ))
    fi
    lvl_lra=$week_reset
    lvl_lu=$cur_pct
    lvl_ts=$lvl_now
    printf '%s %s %s %s' "$lvl_bank" "$lvl_lra" "$lvl_lu" "$lvl_ts" > "${lvl_file}.tmp" 2>/dev/null \
      && mv "${lvl_file}.tmp" "$lvl_file" 2>/dev/null
  fi
  level=$(( lvl_bank / 100 + 1 ))
  # When at the weekly cap (100%), detect ACTIVE credit burn: session cost rising.
  # If burning, flicker the bar like flame (yellow→orange→red via the sprite
  # frame) + 🔥. At the cap but idle → static. (Only runs when capped — no
  # overhead otherwise. There is no explicit "credits used" field in the feed.)
  exp_rgb='245;205;65'; exp_flame=""
  if [ "$cur_pct" -ge 100 ]; then
    csid=$(echo "$input" | jq -r '.session_id // "x"')
    cost_file="/tmp/claude-statusline-cost-${csid}"
    cost_cents=$(awk -v c="$(echo "$input" | jq -r '.cost.total_cost_usd // 0')" 'BEGIN{printf "%d", c*100}')
    read last_cents last_active < "$cost_file" 2>/dev/null
    case "$last_cents"  in ''|*[!0-9]*) last_cents=0 ;; esac
    case "$last_active" in ''|*[!0-9]*) last_active=0 ;; esac
    if [ "$last_cents" -gt 0 ] && [ "$cost_cents" -gt "$last_cents" ]; then last_active=$lvl_now; fi
    printf '%s %s' "$cost_cents" "$last_active" > "${cost_file}.tmp" 2>/dev/null && mv "${cost_file}.tmp" "$cost_file" 2>/dev/null
    if [ $(( lvl_now - last_active )) -lt 15 ]; then
      case "${frame:-0}" in
        0|1) exp_rgb='245;205;65' ;;   # yellow
        2|3) exp_rgb='255;150;50' ;;   # orange
        *)   exp_rgb='255;90;50'  ;;   # red-orange
      esac
      exp_flame=" \033[1m\033[38;2;255;90;50m🔥\033[0m"
    fi
  fi
  exp_seg="\033[38;2;245;205;65mEXP\033[0m $(render_gauge "$cur_pct" "$exp_rgb")${exp_flame} \033[1m\033[38;2;255;220;90m⭐Lv ${level}\033[0m"
  # Weekly-reset cooldown — only shown when the 7-day quota is running low
  # (current usage > 70%), as a warning of when the window refreshes.
  if [ "$cur_pct" -gt 70 ] && [ "$week_reset" -ne 0 ]; then
    secs_left=$(( week_reset - lvl_now ))
    [ "$secs_left" -lt 0 ] && secs_left=0
    if [ "$(( secs_left / 86400 ))" -ge 1 ]; then cd_str="$(( secs_left / 86400 ))d"; else cd_str="$(( secs_left / 3600 ))h"; fi
    exp_seg="${exp_seg} \033[38;2;255;140;60m⏳ ${cd_str}\033[0m"
  fi
  vitals+=("$exp_seg")
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
  play_h=$(( dur_ms / 3600000 ))   # whole hours only
  seg_play="\033[38;2;180;180;200m🕹 ${play_h}h\033[0m"
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

# Trial (CI) — the current branch's check-runs rolled up, WoW raid flavor:
#   🏅 Clear (passed) · 💀 Wipe (failed) · ⚔ Pull (running). gh, cached like PRs.
seg_ci=""
if [ -n "$repo_owner" ] && [ -n "$repo_name" ] && [ -n "$branch" ] && command -v gh >/dev/null 2>&1; then
  ci_key=$(printf '%s_%s_%s' "$repo_owner" "$repo_name" "$branch" | tr -c 'A-Za-z0-9_' '_')
  ci_val="/tmp/claude-statusline-ci-${ci_key}.val"
  ci_stamp="/tmp/claude-statusline-ci-${ci_key}.stamp"
  ci_stamp_m=$(stat -f %m "$ci_stamp" 2>/dev/null || echo 0)
  if [ $(( $(date +%s) - ci_stamp_m )) -ge 120 ]; then
    : > "$ci_stamp"
    ( st=$(gh api "repos/${repo_owner}/${repo_name}/commits/${branch}/check-runs" --jq 'if (.check_runs|length)==0 then "none" elif any(.check_runs[]; .conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out" or .conclusion=="action_required") then "fail" elif any(.check_runs[]; .status!="completed") then "run" else "pass" end' 2>/dev/null)
      printf '%s' "${st:-none}" > "${ci_val}.tmp" 2>/dev/null && mv "${ci_val}.tmp" "$ci_val" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$ci_val" ]; then
    case "$(cat "$ci_val" 2>/dev/null)" in
      pass) seg_ci="\033[38;2;120;220;130m🏅 Clear\033[0m" ;;
      fail) seg_ci="\033[38;2;255;85;85m💀 Wipe\033[0m" ;;
      run)  seg_ci="\033[38;2;255;180;80m⚔ Pull\033[0m" ;;
    esac
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
for s in "$seg_kingdom" "$seg_gil" "$seg_play" "$seg_pr" "$seg_ci" \
         "$seg_area" "$seg_quest" "$seg_worktree" "$seg_tale" \
         "$seg_agent" "$seg_realm" "$seg_style" "$seg_vim" "$seg_added"; do
  [ -n "$s" ] && info+=("$s")
done

# ── Boss Fight ─────────────────────────────────────────────────────────────
# If the latest TodoWrite block (parsed from the transcript) has an incomplete
# task list, the run is a "boss fight": the objective is a WoW boss (stable hash
# of the task contents → boss name), task completion is the boss's HP, and line 2
# switches to the boss/target frame. Cached + background-parsed (transcripts are
# large). Cache format: "total|done|boss|active_task".
boss_mode=0; boss_total=0; boss_done=0; boss_name=""; boss_active=""
b_transcript=$(echo "$input" | jq -r '.transcript_path // empty')
b_sid=$(echo "$input" | jq -r '.session_id // "x"')
boss_cache="/tmp/claude-statusline-boss-${b_sid}"
boss_stamp="/tmp/claude-statusline-boss-${b_sid}.stamp"
if [ -n "$b_transcript" ] && [ -f "$b_transcript" ] && command -v jq >/dev/null 2>&1; then
  b_stamp_m=$(stat -f %m "$boss_stamp" 2>/dev/null || echo 0)
  if [ $(( $(date +%s) - b_stamp_m )) -ge 15 ]; then
    : > "$boss_stamp"
    ( b_line=$(grep -aE '"todos":\[' "$b_transcript" 2>/dev/null | tail -1)
      b_sum=""
      [ -n "$b_line" ] && b_sum=$(printf '%s' "$b_line" | jq -r '[.. | objects | select(has("todos")) | .todos] | last as $t | ($t|length) as $n | ([$t[]|select(.status=="completed")]|length) as $d | ([$t[]|select(.status=="in_progress")][0]) as $a | (($a.activeForm // $a.content) // "" | gsub("[\t\n\r]";" ")) as $act | ([$t[]|.content]|join(" ")|gsub("[\t\n\r]";" ")) as $c | "\($n)\t\($d)\t\($act)\t\($c)"' 2>/dev/null)
      if [ -n "$b_sum" ]; then
        b_n=$(printf '%s' "$b_sum" | cut -f1); b_d=$(printf '%s' "$b_sum" | cut -f2)
        b_act=$(printf '%s' "$b_sum" | cut -f3); b_c=$(printf '%s' "$b_sum" | cut -f4)
        BOSSES=("Ragnaros" "Nefarian" "Kel'Thuzad" "Illidan" "Kil'jaeden" "Arthas" "Deathwing" "Yogg-Saron" "C'Thun" "Onyxia" "Archimonde" "Sargeras" "Garrosh" "N'Zoth" "Algalon" "Lady Vashj")
        b_h=$(printf '%s' "$b_c" | cksum | awk '{print $1}')
        b_name=${BOSSES[$(( b_h % ${#BOSSES[@]} ))]}
        printf '%s|%s|%s|%s' "${b_n:-0}" "${b_d:-0}" "$b_name" "$b_act" > "${boss_cache}.tmp" 2>/dev/null && mv "${boss_cache}.tmp" "$boss_cache" 2>/dev/null
      else
        rm -f "$boss_cache" 2>/dev/null
      fi
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$boss_cache" ]; then
    IFS='|' read boss_total boss_done boss_name boss_active < "$boss_cache"
    case "$boss_total" in ''|*[!0-9]*) boss_total=0 ;; esac
    case "$boss_done"  in ''|*[!0-9]*) boss_done=0 ;; esac
    [ "$boss_total" -gt 0 ] && [ "$boss_done" -lt "$boss_total" ] && boss_mode=1
  fi
fi

# ── Party / Raid ───────────────────────────────────────────────────────────
# Count currently-running sub-agents (Claude Teams): Task/Agent tool_use ids in
# the transcript without a matching tool_result. 1–5 = Party, >5 = Raid. Cached.
seg_party=""
if [ -n "$b_transcript" ] && [ -f "$b_transcript" ] && command -v jq >/dev/null 2>&1; then
  party_cache="/tmp/claude-statusline-party-${b_sid}"
  party_stamp="/tmp/claude-statusline-party-${b_sid}.stamp"
  p_stamp_m=$(stat -f %m "$party_stamp" 2>/dev/null || echo 0)
  if [ $(( $(date +%s) - p_stamp_m )) -ge 15 ]; then
    : > "$party_stamp"
    ( running=$(jq -rs '[.[] | .. | objects | select(.type=="tool_use" and (.name=="Task" or .name=="Agent")) | .id] as $s | [.[] | .. | objects | select(.type=="tool_result") | .tool_use_id] as $d | (($s - $d) | length)' "$b_transcript" 2>/dev/null)
      printf '%s' "${running:-0}" > "${party_cache}.tmp" 2>/dev/null && mv "${party_cache}.tmp" "$party_cache" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$party_cache" ]; then
    p_n=$(cat "$party_cache" 2>/dev/null); case "$p_n" in ''|*[!0-9]*) p_n=0 ;; esac
    if [ "$p_n" -gt 5 ]; then
      seg_party="\033[1m\033[38;2;255;120;90m🚩 Raid (${p_n})\033[0m"
    elif [ "$p_n" -ge 1 ]; then
      seg_party="\033[38;2;150;200;255m👥 Party (${p_n})\033[0m"
    fi
  fi
fi
[ -n "$seg_party" ] && l1+=("$seg_party")

line1="${sprite_l1}$(join_with "$sep" "${l1[@]}")"
if [ "$boss_mode" = "1" ]; then
  # Boss/target frame replaces line 2. HP = remaining tasks (drains as you win).
  # WoW-style solid health bar: red fill, dim empty, % AFTER it (no centered chip
  # — keeps the boss HP clean regardless of fill level).
  boss_rem=$(( (boss_total - boss_done) * 100 / boss_total ))
  bhp_fill=$(( (boss_rem * 8 + 50) / 100 )); bhp=""; bi=0
  while [ "$bi" -lt 8 ]; do
    if [ "$bi" -lt "$bhp_fill" ]; then bhp="${bhp}\033[38;2;255;85;85m█"; else bhp="${bhp}\033[38;2;95;95;115m░"; fi
    bi=$(( bi + 1 ))
  done
  bhp="${bhp}\033[0m"
  boss_frame="\033[1m\033[38;2;255;80;80m💀 ${boss_name}\033[0m  \033[38;2;255;85;85mHP\033[0m ${bhp} \033[38;2;255;85;85m${boss_rem}%\033[0m  \033[38;2;200;200;210m⚔ ${boss_done}/${boss_total} down\033[0m"
  [ -n "$boss_active" ] && boss_frame="${boss_frame}  \033[38;2;255;200;120m▶ $(clip "$boss_active" 28)\033[0m"
  line2="${sprite_l2}${boss_frame}"
else
  line2="${sprite_l2}$(join_with "$sep" "${info[@]}")"
fi

# ── Ambient magic ──────────────────────────────────────────────────────────
# ~6% of renders, a random colored sparkle/rune flickers onto a random line —
# a little spell shimmer drifting across the HUD.
fx_glyphs="✨ 💫 🌟 ❈ ✺ ⟡ ✧ ❉"   # magic-only; avoids ⭐(level) ✦(dirty) 🪄🔮💀🔥🌀(HUD)
fx_colors="255;120;220 130;200;255 255;220;120 185;130;255 130;255;200 255;160;90"
if [ $(( RANDOM % 16 )) -eq 0 ]; then
  set -- $fx_glyphs;  eval "fx_g=\${$(( RANDOM % $# + 1 ))}"
  set -- $fx_colors;  eval "fx_c=\${$(( RANDOM % $# + 1 ))}"
  fx="\033[1m\033[38;2;${fx_c}m${fx_g}\033[0m"
  if [ $(( RANDOM % 2 )) -eq 0 ]; then line1="${line1}  ${fx}"; else line2="${line2}  ${fx}"; fi
fi

# Print both lines (only emit line 2 if it has content beyond the sprite).
if [ -n "$line2" ]; then
  printf '%b\n%b\n' "$line1" "$line2"
else
  printf '%b\n' "$line1"
fi
