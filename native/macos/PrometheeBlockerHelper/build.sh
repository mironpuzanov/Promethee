#!/bin/bash
# Build and sign the PrometheeBlockerHelper binary.
# Output: ./app.promethee.blocker-helper
#
# Uses ad-hoc signing by default so no Apple cert is required.
# Set APPLE_SIGNING_IDENTITY env var to sign with a real cert for notarization:
#   APPLE_SIGNING_IDENTITY="Apple Distribution: ..." bash build.sh

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER_ID="app.promethee.blocker-helper"
BINARY_OUT="$DIR/$HELPER_ID"
IDENTITY="${APPLE_SIGNING_IDENTITY:--}"  # default: ad-hoc

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
