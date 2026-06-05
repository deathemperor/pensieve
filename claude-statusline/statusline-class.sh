#!/usr/bin/env bash
# Class chooser for the RPG status line. Writes the chosen WoW vanilla class to
# ~/.claude/.statusline-class, which statusline-command.sh reads and renders in
# that class's color. Shared across all Claude profiles (they read ~/.claude).
#
# Usage:
#   bash statusline-class.sh              # interactive menu
#   bash statusline-class.sh mage         # set directly
#   bash statusline-class.sh reset        # back to showing the model

CLASS_FILE="$HOME/.claude/.statusline-class"
CLASSES="warrior paladin hunter rogue priest shaman mage warlock druid"

icon() { case "$1" in
  warrior) printf '🪓' ;; paladin) printf '🔨' ;; hunter) printf '🏹' ;;
  rogue) printf '🗡' ;; priest) printf '🙏' ;; shaman) printf '🌩' ;;
  mage) printf '🧙' ;; warlock) printf '😈' ;; druid) printf '🐻' ;;
esac; }

set_class() {
  printf '%s' "$1" > "$CLASS_FILE" && echo "Class set: $(icon "$1") ${1}  (restart/refresh to see it)"
}

arg=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
case "$arg" in
  "" ) : ;;  # fall through to interactive
  reset|none|model|clear) rm -f "$CLASS_FILE"; echo "Class reset — showing the model again."; exit 0 ;;
  *)
    case " $CLASSES " in
      *" $arg "*) set_class "$arg"; exit 0 ;;
      *) echo "Unknown class: $arg"; echo "Valid: $CLASSES  (or 'reset')"; exit 1 ;;
    esac ;;
esac

# Interactive menu
echo "Choose your class:"
i=1
for c in $CLASSES; do printf '  %d) %s %s\n' "$i" "$(icon "$c")" "$c"; i=$((i+1)); done
echo "  r) reset to model"
printf 'Pick [1-9/r]: '
read choice
case "$choice" in
  r|R|reset) rm -f "$CLASS_FILE"; echo "Class reset — showing the model again." ;;
  *[!0-9]*|"") echo "No change." ;;
  *)
    sel=$(printf '%s' "$CLASSES" | cut -d' ' -f"$choice" 2>/dev/null)
    if [ -n "$sel" ]; then set_class "$sel"; else echo "Out of range — no change."; fi ;;
esac
