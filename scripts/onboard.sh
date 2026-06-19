#!/usr/bin/env bash
# scripts/onboard.sh
#
# One-shot developer onboarding: installs the CLI toolbelt this project (and
# its maintainers) lean on. Safe to re-run — every step is idempotent, so
# already-installed tools are skipped and nothing is clobbered.
#
# Usage:
#   scripts/onboard.sh             # install everything
#   scripts/onboard.sh --core      # only the everyday essentials (skip the long tail)
#   scripts/onboard.sh --no-shell  # skip appending shell init to your rc file
#
# Requires: macOS or Linux with Homebrew. The script installs Homebrew if it's
# missing. Optional pieces (composio, llmfit) are best-effort and won't fail the run.
set -euo pipefail

CORE_ONLY=false
TOUCH_SHELL=true
for arg in "$@"; do
  case "$arg" in
    --core)     CORE_ONLY=true ;;
    --no-shell) TOUCH_SHELL=false ;;
    -h|--help)  sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$1" >&2; }

# Fetch a remote install script to a temp file, then execute it — instead of
# piping curl straight into a shell. Same end result, but the downloaded script
# lands on disk first so it can be inspected and isn't a live attacker-controlled
# stream feeding your shell. Pass the URL; extra args go to the script.
run_remote_installer() {
  local url="$1"; shift
  local tmp; tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN
  curl -fsSL "$url" -o "$tmp" || return 1
  bash "$tmp" "$@"
}

# ---------------------------------------------------------------------------
# Homebrew
# ---------------------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  log "Homebrew not found — installing"
  run_remote_installer "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"
  # Make brew available for the rest of this run (Apple Silicon vs Intel paths).
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

# ---------------------------------------------------------------------------
# Homebrew formulae, grouped by purpose.
# CORE = the tools you'll reach for daily. EXTRA = the rest of the loved set.
# ---------------------------------------------------------------------------
CORE=(
  # search · files · navigation
  ripgrep fd fzf bat eza zoxide yazi
  # git
  git-delta lazygit gh git-absorb difftastic
  # json · yaml · data
  jq yq gron jless
  # http · net
  xh
  # text transforms
  sd ast-grep
  # system
  btop dust duf procs
  # dev workflow
  watchexec hyperfine tealdeer glow gum tmux shellcheck shfmt just direnv
  # media
  ffmpeg
)

EXTRA=(
  # search · files
  broot fselect
  # git
  gitui
  # json · yaml · data
  fx miller dasel csvlens visidata
  # http · net
  curlie xurls urlscan doggo gping bandwhich websocat mitmproxy
  # text transforms
  choose-rust comby
  # system
  bottom glances ncdu
  # dev workflow
  entr mprocs atuin navi
  # containers
  lazydocker dive k9s
  # media · docs
  yt-dlp pandoc qsv hexyl tokei imagemagick
  # security · secrets
  gitleaks trufflehog age sops
)

FORMULAE=("${CORE[@]}")
$CORE_ONLY || FORMULAE+=("${EXTRA[@]}")

log "Installing ${#FORMULAE[@]} Homebrew formulae (already-installed ones are skipped)"
failed=()
for f in "${FORMULAE[@]}"; do
  if brew list --formula "$f" >/dev/null 2>&1; then
    continue
  fi
  if ! brew install "$f" >/dev/null 2>&1; then
    failed+=("$f")
    warn "failed to install: $f"
  fi
done
if [ ${#failed[@]} -eq 0 ]; then
  log "All formulae present"
else
  warn "Skipped (install manually): ${failed[*]}"
fi

# ---------------------------------------------------------------------------
# gh extensions
# ---------------------------------------------------------------------------
if command -v gh >/dev/null 2>&1 && ! gh extension list 2>/dev/null | grep -q "dlvhdr/gh-dash"; then
  log "Installing gh-dash extension"
  gh extension install dlvhdr/gh-dash >/dev/null 2>&1 || warn "gh-dash install skipped (gh auth required?)"
fi

# ---------------------------------------------------------------------------
# Optional, non-brew tools (best-effort — never fail the run)
# ---------------------------------------------------------------------------
if [ "$CORE_ONLY" = false ]; then
  # Composio — gateway to 1000+ SaaS apps. `composio login` to use it.
  if ! command -v composio >/dev/null 2>&1; then
    log "Installing Composio CLI"
    if run_remote_installer "https://composio.dev/install" >/dev/null 2>&1; then
      [ -x "$HOME/.composio/composio" ] && ln -sf "$HOME/.composio/composio" "$(brew --prefix)/bin/composio"
    else
      warn "Composio install skipped"
    fi
  fi

  # llmfit — matches local AI models to your hardware. Installed in an isolated venv.
  if ! command -v llmfit >/dev/null 2>&1; then
    if command -v pipx >/dev/null 2>&1 || brew install pipx >/dev/null 2>&1; then
      log "Installing llmfit (pipx)"
      pipx install llmfit >/dev/null 2>&1 || warn "llmfit install skipped"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Shell init — atuin (history) and direnv need a hook in your rc file.
# ---------------------------------------------------------------------------
if [ "$TOUCH_SHELL" = true ]; then
  case "${SHELL##*/}" in
    zsh)  RC="$HOME/.zshrc";  SH=zsh ;;
    bash) RC="$HOME/.bashrc"; SH=bash ;;
    *)    RC=""; warn "Unrecognized shell '${SHELL##*/}' — add atuin/direnv init manually" ;;
  esac
  if [ -n "$RC" ]; then
    added=false
    # Single quotes are intentional: we write the literal `eval "$(... init)"`
    # line into the rc file; it must expand at shell startup, not now.
    # shellcheck disable=SC2016
    grep -q "atuin init"  "$RC" 2>/dev/null || { command -v atuin  >/dev/null 2>&1 && { printf '\n# atuin (shell history)\neval "$(atuin init %s)"\n' "$SH"  >> "$RC"; added=true; }; }
    # shellcheck disable=SC2016
    grep -q "direnv hook" "$RC" 2>/dev/null || { command -v direnv >/dev/null 2>&1 && { printf '\n# direnv (per-dir env)\neval "$(direnv hook %s)"\n' "$SH" >> "$RC"; added=true; }; }
    $added && log "Added atuin/direnv init to $RC — run: source $RC"
  fi
fi

log "Onboarding complete. Open a new shell to pick up everything."
