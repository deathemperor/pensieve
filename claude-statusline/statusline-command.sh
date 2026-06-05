#!/usr/bin/env bash
# Claude Code status line — WoW-style RPG character HUD
# Line 1 — hero + vitals:  [portrait] 🪄 <name> · 🧙 class · HP · MP · EXP · 🔮 power · ⚔ dmg · buffs
# Line 2 — world/stats:    [portrait] 🏰 kingdom · 💰 Gold · 🕹 playtime · ⚑ PRs · 🗺 area · 📜 quest · ⛺ camp · 📖 tale
#
# PERF: runs every second in every pane (refreshInterval=1). To stay cheap it
# extracts ALL feed fields in ONE jq call (not ~25 separate spawns), computes the
# clock once, and pushes git/gh/transcript work into background-cached jobs. Keep
# it that way — a per-render spawn storm makes the whole terminal lag.
#
# bash 3.2 SAFE: no associative arrays, no namerefs. Colors are stored as
# literal \033 and decoded once by the final `printf '%b'`.

input=$(cat)
printf '%s' "$input" > /tmp/claude-statusline-input.json 2>/dev/null
NOW=$(date +%s)
SPRITE_ENABLED=1   # portrait on/off

# === ONE jq call: extract every scalar field we need (tab-separated). =========
# Delimiter is 0x1f (unit separator) — NOT whitespace, so `read` preserves empty
# fields instead of collapsing adjacent tabs and shifting every column.
IFS=$'\037' read -r f_sid f_cwd f_projdir f_transcript f_model f_session f_effort \
  f_owner f_repo f_worktree f_style f_agent f_vim f_cost f_dur f_ladd f_lrem \
  f_remain f_exceeds f_thinking f_fast f_five f_seven_used f_seven_reset f_addc <<EOF
$(printf '%s' "$input" | jq -r '
  [ (.session_id // "x"),
    (.workspace.current_dir // .cwd // ""),
    (.workspace.project_dir // ""),
    (.transcript_path // ""),
    ((.model.display_name // "") | gsub("\\s*\\([^)]*\\)\\s*$";"") | sub("^Opus ";"O ") | sub("^Sonnet ";"S ") | sub("^Haiku ";"H ")),
    ((.session_name // "") | gsub("[\t\n\r]";" ")),
    (.effort.level // ""),
    (.workspace.repo.owner // ""),
    (.workspace.repo.name // ""),
    (.worktree.name // ""),
    (.output_style.name // ""),
    (.agent.name // ""),
    (.vim.mode // ""),
    (.cost.total_cost_usd // ""),
    (.cost.total_duration_ms // ""),
    (.cost.total_lines_added // 0),
    (.cost.total_lines_removed // 0),
    (.context_window.remaining_percentage // ""),
    (.exceeds_200k_tokens // false),
    (.thinking.enabled // false),
    (.fast_mode // false),
    (.rate_limits.five_hour.used_percentage // ""),
    (.rate_limits.seven_day.used_percentage // ""),
    (.rate_limits.seven_day.resets_at // 0),
    ((.workspace.added_dirs // []) | length)
  ] | map(tostring) | join("")')
EOF
f_sid=${f_sid:-x}; f_addc=${f_addc:-0}

# --- RPG gauge: slim 8-cell bar with the % centered inside it (HP/MP/EXP). -----
render_gauge() {
  local pct=$1 rgb=$2
  if [ "$pct" -gt 100 ]; then pct=100; fi
  if [ "$pct" -lt 0 ]; then pct=0; fi
  local W=8
  local filled=$(( (pct * W + 50) / 100 ))
  local label="${pct}%"
  local llen=${#label}
  local start=$(( (W - llen) / 2 ))
  local fill="\033[38;2;${rgb}m"
  local chip_on="\033[48;2;${rgb}m\033[1m\033[38;2;25;25;35m"
  local chip_off="\033[48;2;60;60;78m\033[1m\033[38;2;${rgb}m"
  local dim='\033[38;2;95;95;115m'
  local rst='\033[0m'
  local out="" i off ch
  for ((i=0; i<W; i++)); do
    if [ "$i" -ge "$start" ] && [ "$i" -lt $(( start + llen )) ]; then
      off=$(( i - start )); ch="${label:off:1}"
      if [ "$i" -lt "$filled" ]; then out="${out}${chip_on}${ch}${rst}"; else out="${out}${chip_off}${ch}${rst}"; fi
    elif [ "$i" -lt "$filled" ]; then
      out="${out}${fill}█${rst}"
    else
      out="${out}${dim}░${rst}"
    fi
  done
  printf '%s' "$out"
}

clip() { local s=$1 m=$2; if [ "${#s}" -gt "$m" ]; then printf '%s…' "${s:0:$((m-1))}"; else printf '%s' "$s"; fi; }

# --- Portrait sprite (Black Mage, animated) ---
sprite_l1=""; sprite_l2=""
if [ "$SPRITE_ENABLED" = "1" ]; then
  HOOD='130;122;235'; SHADE='80;74;180'; EYES='250;215;75'
  frame_file="/tmp/claude-statusline-frame-${f_sid}"
  read frame < "$frame_file" 2>/dev/null   # builtin read, no `cat` spawn
  case "$frame" in ''|*[!0-9]*) frame=0 ;; esac
  echo $(( (frame + 1) % 6 )) > "$frame_file" 2>/dev/null
  case "$frame" in
    0|4) eye="$EYES" ;; 1|3) eye='220;185;55' ;; 2) eye='150;125;45' ;; 5) eye="$SHADE" ;;
  esac
  sprite_l1="\033[38;2;${HOOD}m▟██▙\033[0m "
  sprite_l2="\033[38;2;${SHADE}m▝\033[38;2;${eye}m••\033[38;2;${SHADE}m▘\033[0m "
fi

user=${USER:-$(whoami)}
hero="\033[38;2;255;209;0m🪄 ${user}\033[0m"

# --- Vitals (HP / MP / EXP) ---
vitals=(); seg_cooldown=""

if [ -n "$f_remain" ]; then
  vitals+=("\033[38;2;255;85;85mHP\033[0m $(render_gauge "${f_remain%.*}" '255;85;85')")
else
  vitals+=("\033[90mHP ░░░░░░░░ --\033[0m")
fi

if [ -n "$f_five" ]; then
  vitals+=("\033[38;2;59;158;255mMP\033[0m $(render_gauge "$(( 100 - ${f_five%.*} ))" '59;158;255')")
else
  vitals+=("\033[90mMP ░░░░░░░░ --\033[0m")
fi

# EXP / Level — bar = current 7-day usage; level banks a week each time
# seven_day.resets_at advances. Persisted, self-healing. See README.
if [ -n "$f_seven_used" ]; then
  cur_pct=${f_seven_used%.*}
  [ "$cur_pct" -gt 100 ] 2>/dev/null && cur_pct=100
  week_reset=$f_seven_reset; case "$week_reset" in ''|*[!0-9]*) week_reset=0 ;; esac
  # Level is DERIVED, not accumulated — race-proof across concurrent sessions.
  # We persist only `first_reset` (the earliest weekly-reset epoch ever seen);
  # since seven_day.resets_at advances ~7 days per weekly rollover, the number of
  # weeks elapsed = (current_reset - first_reset) / 604800. Every session computes
  # the SAME level deterministically; the only write lowers first_reset (idempotent,
  # converges) and uses a per-PID temp so concurrent writes can't corrupt it.
  lvl_file="$HOME/.claude/.statusline-level"
  read first_reset _rest < "$lvl_file" 2>/dev/null
  case "$first_reset" in ''|*[!0-9]*) first_reset=0 ;; esac
  [ "$first_reset" -lt 1000000000 ] && first_reset=0      # heal corrupt / old 4-field format
  if [ "$week_reset" -ge 1000000000 ] && { [ "$first_reset" -eq 0 ] || [ "$week_reset" -lt "$first_reset" ]; }; then
    first_reset=$week_reset
    printf '%s' "$first_reset" > "${lvl_file}.tmp.$$" 2>/dev/null && mv "${lvl_file}.tmp.$$" "$lvl_file" 2>/dev/null
  fi
  if [ "$first_reset" -ne 0 ] && [ "$week_reset" -ge "$first_reset" ]; then
    level=$(( (week_reset - first_reset) / 604800 + 1 ))
  else
    level=1
  fi
  # Active credit burn at the cap → flame flicker + 🔥.
  exp_rgb='245;205;65'; exp_flame=""
  if [ "$cur_pct" -ge 100 ]; then
    cost_file="/tmp/claude-statusline-cost-${f_sid}"
    cost_cents=$(awk -v c="${f_cost:-0}" 'BEGIN{printf "%d", c*100}')
    read last_cents last_active < "$cost_file" 2>/dev/null
    case "$last_cents"  in ''|*[!0-9]*) last_cents=0 ;; esac
    case "$last_active" in ''|*[!0-9]*) last_active=0 ;; esac
    if [ "$last_cents" -gt 0 ] && [ "$cost_cents" -gt "$last_cents" ]; then last_active=$NOW; fi
    printf '%s %s' "$cost_cents" "$last_active" > "${cost_file}.tmp" 2>/dev/null && mv "${cost_file}.tmp" "$cost_file" 2>/dev/null
    if [ $(( NOW - last_active )) -lt 15 ]; then
      case "${frame:-0}" in 0|1) exp_rgb='245;205;65' ;; 2|3) exp_rgb='255;150;50' ;; *) exp_rgb='255;90;50' ;; esac
      exp_flame=" \033[1m\033[38;2;255;90;50m🔥\033[0m"
    fi
  fi
  exp_seg="\033[38;2;245;205;65mEXP\033[0m $(render_gauge "$cur_pct" "$exp_rgb")${exp_flame} \033[1m\033[38;2;255;220;90m⭐Lv ${level}\033[0m"
  # Weekly-reset cooldown → its own segment, placed last on line 2 (only > 70%).
  if [ "$cur_pct" -gt 70 ] && [ "$week_reset" -ne 0 ]; then
    secs_left=$(( week_reset - NOW )); [ "$secs_left" -lt 0 ] && secs_left=0
    if [ "$(( secs_left / 86400 ))" -ge 1 ]; then cd_str="$(( secs_left / 86400 ))d"; else cd_str="$(( secs_left / 3600 ))h"; fi
    seg_cooldown="\033[38;2;255;140;60m⏳ ${cd_str}\033[0m"
  fi
  vitals+=("$exp_seg")
else
  vitals+=("\033[90mEXP ░░░░░░░░ --\033[0m")
fi

# --- Segments ---
seg_class=""; [ -n "$f_model" ] && seg_class="\033[38;2;63;199;235m🧙 ${f_model}\033[0m"

# Area — last 2 path components (pure bash, no awk spawn)
seg_area=""
if [ -n "$f_cwd" ]; then
  short_cwd="${f_cwd/#$HOME/~}"
  case "$short_cwd" in
    */*/*) rest="${short_cwd%/*}"; dir_display="…/${rest##*/}/${short_cwd##*/}" ;;
    *) dir_display="$short_cwd" ;;
  esac
  seg_area="\033[33m🗺 ${dir_display}\033[0m"
fi

# Quest (git branch + dirty) — CACHED in background (git status is slow in big repos)
seg_quest=""; branch=""; git_dirty=0
if [ -n "$f_cwd" ]; then
  git_key=$(printf '%s' "$f_cwd" | cksum); git_key=${git_key%% *}   # cksum only, no awk
  git_cache="/tmp/claude-statusline-git-${git_key}"
  git_m=$(stat -f %m "$git_cache" 2>/dev/null || echo 0)
  if [ $(( NOW - git_m )) -ge 5 ]; then
    ( gb=$(git --no-optional-locks -C "$f_cwd" symbolic-ref --short HEAD 2>/dev/null \
            || git --no-optional-locks -C "$f_cwd" rev-parse --short HEAD 2>/dev/null)
      gd=0; [ -n "$(git --no-optional-locks -C "$f_cwd" status --porcelain 2>/dev/null | head -1)" ] && gd=1
      printf '%s\t%s' "$gb" "$gd" > "${git_cache}.tmp" 2>/dev/null && mv "${git_cache}.tmp" "$git_cache" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  [ -f "$git_cache" ] && IFS=$'\t' read -r branch git_dirty < "$git_cache"
fi
if [ -n "$branch" ]; then
  br=$(clip "$branch" 24)
  if [ "${git_dirty:-0}" = "1" ]; then
    seg_quest="\033[34m\033[33m✦\033[34m 📜 ${br}\033[0m"
  else
    seg_quest="\033[34m📜 ${br}\033[0m"
  fi
fi

seg_worktree=""; [ -n "$f_worktree" ] && seg_worktree="\033[34m⛺ $(clip "$f_worktree" 20)\033[0m"
seg_tale="";     [ -n "$f_session" ] && seg_tale="\033[38;2;230;200;120m📖 «$(clip "$f_session" 24)»\033[0m"
seg_power="";    [ -n "$f_effort" ] && seg_power="\033[35m🔮 ${f_effort}\033[0m"

seg_gil=""
if [ -n "$f_cost" ]; then
  cost_fmt=$(printf '%.2f' "$f_cost" 2>/dev/null || echo "$f_cost")
  seg_gil="\033[38;2;245;205;65m💰 ${cost_fmt} Gold\033[0m"
fi

seg_agent=""; [ -n "$f_agent" ] && seg_agent="\033[35m🎭 ${f_agent}\033[0m"

seg_realm=""
if [ -n "$f_projdir" ]; then
  dev_mode=$(cat "${f_projdir}/.claude/.dev-mode" 2>/dev/null | tr -d '[:space:]')
  [ -n "$dev_mode" ] && seg_realm="\033[35m🔧 ${dev_mode}\033[0m"
fi

seg_style=""; [ -n "$f_style" ] && [ "$f_style" != "default" ] && seg_style="\033[35m🎨 ${f_style}\033[0m"

seg_vim=""
if [ -n "$f_vim" ]; then
  if [ "$f_vim" = "INSERT" ]; then vc="\033[32m"; else vc="\033[33m"; fi
  seg_vim="${vc}✏️  ${f_vim}\033[0m"
fi

seg_added=""; [ "$f_addc" -gt 0 ] 2>/dev/null && seg_added="\033[37m📂 +${f_addc}\033[0m"

seg_dmg=""
if [ "${f_ladd:-0}" != "0" ] || [ "${f_lrem:-0}" != "0" ]; then
  seg_dmg="\033[38;2;255;140;60m⚔ +${f_ladd}/-${f_lrem}\033[0m"
fi

seg_play=""
if [ -n "$f_dur" ] && [ "$f_dur" -gt 0 ] 2>/dev/null; then
  seg_play="\033[38;2;180;180;200m🕹 $(( f_dur / 3600000 ))h\033[0m"
fi

seg_kingdom=""; [ -n "$f_repo" ] && seg_kingdom="\033[38;2;200;170;120m🏰 ${f_repo}\033[0m"

# Bounties (open PRs) — cached, background gh.
seg_pr=""
if [ -n "$f_owner" ] && [ -n "$f_repo" ] && command -v gh >/dev/null 2>&1; then
  pr_key=$(printf '%s_%s' "$f_owner" "$f_repo" | tr -c 'A-Za-z0-9_' '_')
  pr_val="/tmp/claude-statusline-prs-${pr_key}.val"; pr_stamp="/tmp/claude-statusline-prs-${pr_key}.stamp"
  pr_m=$(stat -f %m "$pr_stamp" 2>/dev/null || echo 0)
  if [ $(( NOW - pr_m )) -ge 300 ]; then
    : > "$pr_stamp"
    ( mine=$(gh pr list -R "${f_owner}/${f_repo}" --author @me --state open --json number --jq 'length' 2>/dev/null)
      revs=$(gh pr list -R "${f_owner}/${f_repo}" --search "review-requested:@me" --state open --json number --jq 'length' 2>/dev/null)
      printf '%s %s' "${mine:-0}" "${revs:-0}" > "${pr_val}.tmp" 2>/dev/null && mv "${pr_val}.tmp" "$pr_val" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$pr_val" ]; then
    read pr_mine pr_revs < "$pr_val"
    seg_pr="\033[38;2;120;200;120m⚑ ${pr_mine:-0}\033[0m"
    [ "${pr_revs:-0}" != "0" ] && seg_pr="${seg_pr} \033[38;2;235;180;90m🛡 ${pr_revs}\033[0m"
  fi
fi

# Trial (CI) — cached, background gh.
seg_ci=""
if [ -n "$f_owner" ] && [ -n "$f_repo" ] && [ -n "$branch" ] && command -v gh >/dev/null 2>&1; then
  ci_key=$(printf '%s_%s_%s' "$f_owner" "$f_repo" "$branch" | tr -c 'A-Za-z0-9_' '_')
  ci_val="/tmp/claude-statusline-ci-${ci_key}.val"; ci_stamp="/tmp/claude-statusline-ci-${ci_key}.stamp"
  ci_m=$(stat -f %m "$ci_stamp" 2>/dev/null || echo 0)
  if [ $(( NOW - ci_m )) -ge 300 ]; then
    : > "$ci_stamp"
    ( st=$(gh api "repos/${f_owner}/${f_repo}/commits/${branch}/check-runs" --jq 'if (.check_runs|length)==0 then "none" elif any(.check_runs[]; .conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out" or .conclusion=="action_required") then "fail" elif any(.check_runs[]; .status!="completed") then "run" else "pass" end' 2>/dev/null)
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

# Status effects (buffs/debuffs)
seg_status=""
[ "$f_thinking" = "true" ] && seg_status="\033[38;2;120;230;180m🌀 Focus\033[0m"
if [ "$f_exceeds" = "true" ]; then [ -n "$seg_status" ] && seg_status="${seg_status}  "; seg_status="${seg_status}\033[38;2;255;140;60m🎒 Encumbered\033[0m"; fi
if [ "$f_fast" = "true" ]; then [ -n "$seg_status" ] && seg_status="${seg_status}  "; seg_status="${seg_status}\033[38;2;255;215;70m⚡ Haste\033[0m"; fi

join_with() { local s=$1; shift; local out="" p; for p in "$@"; do if [ -z "$out" ]; then out="$p"; else out="${out}${s}${p}"; fi; done; printf '%s' "$out"; }
sep=" \033[90m·\033[0m "

l1=("$hero")
[ -n "$seg_class" ] && l1+=("$seg_class")
l1+=("${vitals[@]}")
[ -n "$seg_power" ] && l1+=("$seg_power")
[ -n "$seg_dmg" ] && l1+=("$seg_dmg")
[ -n "$seg_status" ] && l1+=("$seg_status")

info=()
for s in "$seg_kingdom" "$seg_gil" "$seg_play" "$seg_pr" "$seg_ci" \
         "$seg_area" "$seg_quest" "$seg_worktree" "$seg_tale" \
         "$seg_agent" "$seg_realm" "$seg_style" "$seg_vim" "$seg_added" \
         "$seg_cooldown"; do
  [ -n "$s" ] && info+=("$s")
done

# ── Boss Fight (cached transcript parse) ──
boss_mode=0; boss_total=0; boss_done=0; boss_name=""; boss_active=""
if [ -n "$f_transcript" ] && [ -f "$f_transcript" ] && command -v jq >/dev/null 2>&1; then
  boss_cache="/tmp/claude-statusline-boss-${f_sid}"; boss_stamp="/tmp/claude-statusline-boss-${f_sid}.stamp"
  b_m=$(stat -f %m "$boss_stamp" 2>/dev/null || echo 0)
  if [ $(( NOW - b_m )) -ge 30 ]; then
    : > "$boss_stamp"
    ( bbuf=$(tail -n 5000 "$f_transcript" 2>/dev/null)   # one read; greps run in-memory
      # (1) TodoWrite path — a "todos":[…] snapshot (overwritten each call)
      b_line=$(printf '%s' "$bbuf" | grep -aE '"todos":\[' | tail -1)
      b_sum=""
      [ -n "$b_line" ] && b_sum=$(printf '%s' "$b_line" | jq -r '[.. | objects | select(has("todos")) | .todos] | last as $t | ($t|length) as $n | ([$t[]|select(.status=="completed")]|length) as $d | ([$t[]|select(.status=="in_progress")][0]) as $a | (($a.activeForm // $a.content) // "" | gsub("[\t\n\r]";" ")) as $act | ([$t[]|.content]|join(" ")|gsub("[\t\n\r]";" ")) as $c | "\($n)\t\($d)\t\($act)\t\($c)"' 2>/dev/null)
      # (2) Agent-teams path — TaskCreate/TaskList snapshot (subject+status objects).
      # Only runs when there's no TodoWrite, so TodoWrite sessions pay nothing extra.
      if [ -z "$b_sum" ]; then
        t_line=$(printf '%s' "$bbuf" | grep -aE '"subject":"' | grep -aE '"status":"' | tail -1)
        [ -n "$t_line" ] && b_sum=$(printf '%s' "$t_line" | jq -r '[.. | objects | select(has("subject") and has("status"))] as $t | ($t|length) as $n | ([$t[]|select(.status=="completed")]|length) as $d | (([$t[]|select(.status=="in_progress")][0].subject) // ([$t[]|select(.status=="pending")][0].subject) // "") as $a | ($a | gsub("[\t\n\r]";" ")) as $act | ([$t[]|.subject]|join(" ")|gsub("[\t\n\r]";" ")) as $c | "\($n)\t\($d)\t\($act)\t\($c)"' 2>/dev/null)
      fi
      if [ -n "$b_sum" ]; then
        b_n=$(printf '%s' "$b_sum" | cut -f1); b_d=$(printf '%s' "$b_sum" | cut -f2)
        b_act=$(printf '%s' "$b_sum" | cut -f3); b_c=$(printf '%s' "$b_sum" | cut -f4)
        BOSSES=("Ragnaros" "Nefarian" "Kel'Thuzad" "Illidan" "Kil'jaeden" "Arthas" "Deathwing" "Yogg-Saron" "C'Thun" "Onyxia" "Archimonde" "Sargeras" "Garrosh" "N'Zoth" "Algalon" "Lady Vashj")
        b_h=$(printf '%s' "$b_c" | cksum | awk '{print $1}')
        b_name=${BOSSES[$(( b_h % ${#BOSSES[@]} ))]}
        printf '%s|%s|%s|%s' "${b_n:-0}" "${b_d:-0}" "$b_name" "$b_act" > "${boss_cache}.tmp" 2>/dev/null && mv "${boss_cache}.tmp" "$boss_cache" 2>/dev/null
      else rm -f "$boss_cache" 2>/dev/null; fi
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$boss_cache" ]; then
    IFS='|' read boss_total boss_done boss_name boss_active < "$boss_cache"
    case "$boss_total" in ''|*[!0-9]*) boss_total=0 ;; esac
    case "$boss_done"  in ''|*[!0-9]*) boss_done=0 ;; esac
    [ "$boss_total" -gt 0 ] && [ "$boss_done" -lt "$boss_total" ] && boss_mode=1
  fi
fi

# ── Party / Raid (cached transcript parse) ──
seg_party=""
if [ -n "$f_transcript" ] && [ -f "$f_transcript" ] && command -v jq >/dev/null 2>&1; then
  party_cache="/tmp/claude-statusline-party-${f_sid}"; party_stamp="/tmp/claude-statusline-party-${f_sid}.stamp"
  p_m=$(stat -f %m "$party_stamp" 2>/dev/null || echo 0)
  if [ $(( NOW - p_m )) -ge 30 ]; then
    : > "$party_stamp"
    ( running=$(tail -n 5000 "$f_transcript" 2>/dev/null | jq -rs '[.[] | .. | objects | select(.type=="tool_use" and (.name=="Task" or .name=="Agent")) | .id] as $s | [.[] | .. | objects | select(.type=="tool_result") | .tool_use_id] as $d | (($s - $d) | length)')
      printf '%s' "${running:-0}" > "${party_cache}.tmp" 2>/dev/null && mv "${party_cache}.tmp" "$party_cache" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi
  if [ -f "$party_cache" ]; then
    p_n=$(cat "$party_cache" 2>/dev/null); case "$p_n" in ''|*[!0-9]*) p_n=0 ;; esac
    if [ "$p_n" -gt 5 ]; then seg_party="\033[1m\033[38;2;255;120;90m🚩 Raid (${p_n})\033[0m"
    elif [ "$p_n" -ge 1 ]; then seg_party="\033[38;2;150;200;255m👥 Party (${p_n})\033[0m"; fi
  fi
fi
[ -n "$seg_party" ] && l1+=("$seg_party")

# ── Ambient magic — ~6% of renders, a sparkle inserted between segments ──
fx_glyphs="✨ 💫 🌟 ❈ ✺ ⟡ ✧ ❉"
fx_colors="255;120;220 130;200;255 255;220;120 185;130;255 130;255;200 255;160;90"
if [ $(( RANDOM % 16 )) -eq 0 ]; then
  set -- $fx_glyphs; eval "fx_g=\${$(( RANDOM % $# + 1 ))}"
  set -- $fx_colors; eval "fx_c=\${$(( RANDOM % $# + 1 ))}"
  fx="\033[1m\033[38;2;${fx_c}m${fx_g}\033[0m"
  if [ $(( RANDOM % 2 )) -eq 0 ] || [ "$boss_mode" = "1" ]; then
    fx_i=$(( RANDOM % (${#l1[@]} + 1) )); l1=("${l1[@]:0:$fx_i}" "$fx" "${l1[@]:$fx_i}")
  elif [ ${#info[@]} -gt 0 ]; then
    fx_i=$(( RANDOM % (${#info[@]} + 1) )); info=("${info[@]:0:$fx_i}" "$fx" "${info[@]:$fx_i}")
  fi
fi

line1="${sprite_l1}$(join_with "$sep" "${l1[@]}")"
if [ "$boss_mode" = "1" ]; then
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

if [ -n "$line2" ]; then
  printf '%b\n%b\n' "$line1" "$line2"
else
  printf '%b\n' "$line1"
fi
