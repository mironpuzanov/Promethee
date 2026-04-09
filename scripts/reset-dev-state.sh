#!/bin/bash
# Promethee — dev state reset
# Cleans up everything so you get a fresh first-run state.
#
# Usage: bash reset-dev-state.sh

echo ""
echo "=== Promethee Dev State Reset ==="
echo ""

# 0. Quit the app if running
if pgrep -x "Promethee" > /dev/null 2>&1; then
  echo "Quitting Promethee..."
  osascript -e 'quit app "Promethee"' 2>/dev/null || killall "Promethee" 2>/dev/null || true
  sleep 1
fi

# 1. Delete all copies of Promethee.app
echo "Looking for Promethee.app..."
FOUND_ANY=0
for LOCATION in \
  "/Applications/Promethee.app" \
  "$HOME/Applications/Promethee.app" \
  "$HOME/Desktop/Promethee.app" \
  "$HOME/Downloads/Promethee.app"
do
  if [ -d "$LOCATION" ]; then
    rm -rf "$LOCATION"
    echo "✓ Deleted $LOCATION"
    FOUND_ANY=1
  fi
done

# Also search Downloads for any unzipped copy
while IFS= read -r -d '' FOUND; do
  rm -rf "$FOUND"
  echo "✓ Deleted $FOUND"
  FOUND_ANY=1
done < <(find "$HOME/Downloads" -maxdepth 2 -name "Promethee.app" -print0 2>/dev/null)

if [ "$FOUND_ANY" = "0" ]; then
  echo "– No Promethee.app found"
fi

# 2. Permission prompt flags
echo ""
USERDATA="$HOME/Library/Application Support/Promethee"
for FILE in "permission-prompts.json" "permissions-onboarding-seen.json"; do
  if [ -f "$USERDATA/$FILE" ]; then
    rm "$USERDATA/$FILE"
    echo "✓ Deleted $FILE"
  else
    echo "– $FILE not found (already clean)"
  fi
done

# 3. Keychain session tokens (Supabase login)
if security delete-generic-password -s "Promethee" -a "session_tokens" 2>/dev/null; then
  echo "✓ Deleted keychain session tokens"
else
  echo "– No keychain entry found (already clean)"
fi

# 4. Electron persistent storage
for DIR in "Cookies" "Local Storage" "Session Storage" "Preferences"; do
  TARGET="$USERDATA/$DIR"
  if [ -e "$TARGET" ]; then
    rm -rf "$TARGET"
    echo "✓ Cleared $DIR"
  fi
done

# 5. SQLite database (optional)
DB="$USERDATA/promethee.db"
if [ -f "$DB" ]; then
  echo ""
  read -p "Delete local database (sessions, habits, tasks)? [y/N] " CONFIRM
  if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
    rm "$DB"
    echo "✓ Deleted promethee.db"
  else
    echo "– Kept promethee.db"
  fi
fi

echo ""
echo "Done. Install the new Promethee app Miron sent you, then open it."
echo ""
