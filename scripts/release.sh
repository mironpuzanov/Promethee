#!/usr/bin/env bash
# release.sh — Build, sign, notarize, staple, and upload a new Promethee release.
#
# Usage:
#   bash scripts/release.sh [--version 1.2.0] [--notes "What changed"]
#
# Required env (loaded from .env automatically):
#   APPLE_APP_PASSWORD
#   SUPABASE_SERVICE_ROLE_KEY
#
# Required tools: node, xcrun, gh

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
step()  { echo -e "\n${CYAN}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── Load .env ────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

# ── Parse args ───────────────────────────────────────────────────────────────
VERSION=""
NOTES=""
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)    VERSION="$2";    shift 2 ;;
    --notes)      NOTES="$2";      shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) die "Unknown arg: $1" ;;
  esac
done

# Fall back to package.json version
if [ -z "$VERSION" ]; then
  VERSION=$(node -e "console.log(require('./package.json').version)")
fi

APPLE_ID="${APPLE_ID:-mironpuzanov@icloud.com}"
TEAM_ID="${APPLE_TEAM_ID:-69V9FN6864}"
ARCH=$(node -e "console.log(process.arch === 'arm64' ? 'arm64' : 'x64')")
APP_PATH="out/Promethee-darwin-${ARCH}/Promethee.app"
DMG_PATH="out/make/Promethee-${VERSION}.dmg"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Promethee Release — v${VERSION}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"

# ── Validate env ─────────────────────────────────────────────────────────────
[ -z "${APPLE_APP_PASSWORD:-}" ]        && die "APPLE_APP_PASSWORD is required (set in .env)"
[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && die "SUPABASE_SERVICE_ROLE_KEY is required (set in .env)"
command -v gh &>/dev/null               || die "gh CLI not found — install from https://cli.github.com"

# ── Step 1: Build + sign .app ─────────────────────────────────────────────────
# 'npm run package' calls electron-forge package which:
#   - Runs Vite build
#   - Runs electron-packager (asar, native modules into app.asar.unpacked, afterComplete hook)
#   - Signs with codesign (osxSign)
#   - Does NOT notarize (osxNotarize is disabled — we do it after DMG creation below)
if [ "$SKIP_BUILD" = true ] && [ -d "$APP_PATH" ]; then
  step "1/4  Skipping build (--skip-build, using existing $APP_PATH)"
else
  step "1/4  Building and signing .app..."
  npm run package 2>&1
  ok "Build complete: $APP_PATH"
fi

# ── Step 2: Create DMG with drag-to-Applications layout ──────────────────────
# IMPORTANT: create DMG from the signed-but-NOT-yet-stapled .app.
# If we staple first and then copy into a DMG, the staple ticket changes the
# bundle and invalidates the codesign seal on the main binary.
step "2/4  Creating styled DMG (appdmg)..."
mkdir -p "$(dirname "$DMG_PATH")"
[ -f "$DMG_PATH" ] && rm "$DMG_PATH"

# Build a per-run appdmg spec with absolute paths injected
# (appdmg resolves paths relative to the spec file, so we use a spec next to the assets)
DMG_SPEC_TMP="$(pwd)/out/dmg-spec-tmp.json"
mkdir -p "$(pwd)/out"
APP_ABS="$(cd "$(dirname "$APP_PATH")" && pwd)/$(basename "$APP_PATH")"
BG_ABS="$(pwd)/scripts/dmg-background.png"
ICON_ABS="$(pwd)/src/assets/icon.icns"
sed -e "s|__APP_PATH__|${APP_ABS}|g" \
    -e "s|scripts/dmg-background.png|${BG_ABS}|g" \
    -e "s|src/assets/icon.icns|${ICON_ABS}|g" \
    scripts/dmg-spec.json > "$DMG_SPEC_TMP"

node_modules/.bin/appdmg "$DMG_SPEC_TMP" "$DMG_PATH"
rm -f "$DMG_SPEC_TMP"
ok "DMG created: $DMG_PATH ($(du -sh "$DMG_PATH" | cut -f1))"

# ── Step 3: Notarize + staple DMG ────────────────────────────────────────────
# Submit the DMG to Apple. The .app inside is signed; notarizing the DMG
# covers the entire package. Then staple the ticket to the DMG.
step "3/4  Notarizing DMG (1–3 min)..."
DMG_SUBMISSION=$(xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --team-id "$TEAM_ID" \
  --output-format json 2>&1)
DMG_SUBMISSION_ID=$(echo "$DMG_SUBMISSION" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])" 2>/dev/null || true)
[ -z "$DMG_SUBMISSION_ID" ] && die "Failed to submit DMG for notarization. Output: $DMG_SUBMISSION"
echo "  Submission ID: $DMG_SUBMISSION_ID"
echo -n "  Waiting"
while true; do
  sleep 15
  STATUS=$(xcrun notarytool info "$DMG_SUBMISSION_ID" \
    --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$TEAM_ID" \
    --output-format json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','In Progress'))" 2>/dev/null || echo "In Progress")
  echo -n "."
  if [ "$STATUS" = "Accepted" ]; then
    echo ""
    ok "DMG notarization accepted"
    break
  elif [ "$STATUS" = "Invalid" ]; then
    echo ""
    xcrun notarytool log "$DMG_SUBMISSION_ID" \
      --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$TEAM_ID" 2>/dev/null || true
    die "DMG notarization rejected — see log above"
  fi
done
xcrun stapler staple "$DMG_PATH"
ok "DMG stapled"

# ── Step 4: Upload to GitHub + publish Supabase manifest ─────────────────────
step "4/4  Uploading to GitHub and publishing update manifest..."

NOTES_TEXT="${NOTES:-Release v${VERSION}}"

# Delete existing release/tag if present, then recreate
gh release delete "v${VERSION}" --repo mironpuzanov/Promethee --yes 2>/dev/null || true
git tag -d "v${VERSION}" 2>/dev/null || true
git push origin ":refs/tags/v${VERSION}" 2>/dev/null || true

gh release create "v${VERSION}" "$DMG_PATH" \
  --repo mironpuzanov/Promethee \
  --title "Promethee ${VERSION}" \
  --notes "$NOTES_TEXT"
ok "GitHub release created"

DOWNLOAD_URL="https://github.com/mironpuzanov/Promethee/releases/download/v${VERSION}/Promethee-${VERSION}.dmg"
RELEASE_URL="https://github.com/mironpuzanov/Promethee/releases/tag/v${VERSION}"

SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" npm run publish:update -- \
  --platform darwin \
  --version "$VERSION" \
  --download-url "$DOWNLOAD_URL" \
  --release-url "$RELEASE_URL" \
  --notes "$NOTES_TEXT"
ok "Update manifest published to Supabase"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Released v${VERSION} successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "  DMG:      ${DMG_PATH}"
echo -e "  Download: ${DOWNLOAD_URL}"
echo -e "  Release:  ${RELEASE_URL}"
echo ""
