#!/bin/bash
# Build and sign the PrometheeBlockerHelper binary.
# Output: ./app.promethee.blocker-helper
#
# Prefers APPLE_SIGNING_IDENTITY when provided. Otherwise it auto-detects a local
# signing identity in this order: Developer ID Application, Apple Development, ad-hoc.
# Example override:
#   APPLE_SIGNING_IDENTITY="Developer ID Application: ..." bash build.sh

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER_ID="app.promethee.blocker-helper"
BINARY_OUT="$DIR/$HELPER_ID"

detect_identity() {
  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    printf '%s\n' "$APPLE_SIGNING_IDENTITY"
    return
  fi

  IDENTITIES="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  FOUND="$(printf '%s\n' "$IDENTITIES" | sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' | head -n 1)"
  if [ -n "$FOUND" ]; then
    printf '%s\n' "$FOUND"
    return
  fi

  FOUND="$(printf '%s\n' "$IDENTITIES" | sed -n 's/.*"\(Apple Development:[^"]*\)".*/\1/p' | head -n 1)"
  if [ -n "$FOUND" ]; then
    printf '%s\n' "$FOUND"
    return
  fi

  printf '%s\n' '-'
}

IDENTITY="$(detect_identity)"

echo "Building PrometheeBlockerHelper..."
swiftc -O -o "$BINARY_OUT" "$DIR/main.swift"

echo "Signing (identity: $IDENTITY)..."
codesign \
  --sign "$IDENTITY" \
  --identifier "$HELPER_ID" \
  --options runtime \
  --force \
  "$BINARY_OUT"

echo "Verifying..."
codesign --verify --verbose "$BINARY_OUT" 2>&1
codesign -dv "$BINARY_OUT" 2>&1 | grep -E "Identifier|TeamIdentifier|Authority"

echo "Done: $BINARY_OUT"
