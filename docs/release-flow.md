# Release Flow

How to ship a new version of Promethee to beta users.

## Steps

### 1. Bump the version

In `package.json`, increment `"version"`:

```json
"version": "1.1.1"
```

### 2. Package and notarize

```bash
npm run make
```

This produces a macOS app bundle and DMG in `out/`.

Current DMG output is typically:

```
out/make/Promethee.dmg
```

Signing behavior today:

- Forge auto-selects a signing identity from the machine:
  - `APPLE_SIGNING_IDENTITY` if set
  - otherwise `Developer ID Application`
  - otherwise `Apple Development`
  - otherwise ad-hoc
- notarization uses:
  - `APPLE_APP_PASSWORD` for the app-specific password
  - optionally `APPLE_ID`
  - optionally `APPLE_TEAM_ID`

If `APPLE_ID` and `APPLE_TEAM_ID` are not set, Forge falls back to the values already configured in the repo. `APPLE_APP_PASSWORD` is the important required env var for notarization.

### 3. Create a GitHub Release and upload the DMG

```bash
gh release create v1.1.1 out/make/Promethee.dmg \
  --title "Promethee 1.1.1" \
  --notes "What changed in this release"
```

The download URL will be:

```
https://github.com/mironpuzanov/Promethee/releases/download/v1.1.1/Promethee.dmg
```

> Note: Supabase Storage has a 50MB object limit on the free tier — the DMG is ~120MB so it won't fit. GitHub Releases has no meaningful size limit and is free.

### 4. Publish the update manifest

```bash
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run publish:update -- \
  --platform darwin \
  --version 1.1.1 \
  --download-url https://github.com/mironpuzanov/Promethee/releases/download/v1.1.1/Promethee.dmg \
  --release-url https://github.com/mironpuzanov/Promethee/releases/tag/v1.1.1 \
  --notes "What changed in this release"
```

This deactivates the previous active row and inserts the new one in `app_updates`.

### 5. Users see the update

In packaged builds, Promethee checks the Supabase update manifest once shortly after launch, then every 12 hours after that. Users can also manually check from Settings.

When a newer version is detected, a banner appears in the full window: "Promethee v1.1.1 is available".

Clicking it opens the DMG URL in the browser. User downloads, installs, done.

## What this is NOT

- No silent background download
- No auto-install or `quitAndInstall`
- No delta patching

Manual download and reinstall for now. Good enough for beta.

## Scripts

| Script | What it does |
|--------|-------------|
| `npm run make` | Build signed + notarized DMG |
| `npm run publish:update` | Push new version row to Supabase |

## Related files

- [scripts/publish-app-update.mjs](../scripts/publish-app-update.mjs) — the publish script
- [src/main/updateCheck.js](../src/main/updateCheck.js) — in-app update check logic
- [supabase/migrations/20260408000001_app_updates.sql](../supabase/migrations/20260408000001_app_updates.sql) — table schema
- [docs/app-updates.md](./app-updates.md) — deeper technical reference
