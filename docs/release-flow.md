# Release Flow

How to ship a new version of Promethee to beta users.

## TL;DR

```bash
# 1. Bump version in package.json
# 2. Run:
rm -rf out && bash scripts/release.sh --notes "AI memory goes live, onboarding challenges, focus button glow-up, visual polish"
```

That's the whole thing. The script handles build, sign, notarize, DMG, upload, and manifest.

---

## Steps

### 1. Bump the version

Edit `package.json`:

```json
"version": "1.2.0"
```

Use semver: patch (`1.1.x`) for bug fixes, minor (`1.x.0`) for new features.

### 2. Run the release script

```bash
rm -rf out && bash scripts/release.sh --notes "AI memory goes live, onboarding challenges, focus button glow-up, visual polish"
```

### Flags

```bash
# Override version (defaults to package.json)
bash scripts/release.sh --version 1.2.0 --notes "..."

# Skip build if you already have a signed+notarized .app in out/
bash scripts/release.sh --skip-build --notes "..."
```

---

## What the script does

| Step | What happens | Time |
|------|-------------|------|
| 1/4 | `npm run package`: Vite build → electron-packager → inject native modules → codesign | ~10 min |
| 2/4 | Create DMG with drag-to-Applications layout | ~30 sec |
| 3/4 | Notarize DMG + staple | ~2 min |
| 4/4 | Upload DMG to GitHub Releases, publish Supabase update manifest | ~1 min |

Total: ~15 min on first run.

> **Note:** Notarization is done on the DMG only, not the `.app`. The `.app` is signed but not stapled — stapling before copying into the DMG breaks the codesign seal.

---

## Required env

Set in `.env` (auto-loaded):

```
APPLE_APP_PASSWORD=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional (has defaults):
```
APPLE_ID=mironpuzanov@icloud.com
APPLE_TEAM_ID=69V9FN6864
```

---

## Signing

Forge auto-selects a signing identity from the keychain:
1. `APPLE_SIGNING_IDENTITY` env var (if set)
2. `Developer ID Application: ...` (preferred for distribution)
3. `Apple Development: ...` (dev only — notarization will fail)
4. Ad-hoc `-` (no notarization)

You need a **Developer ID Application** cert for proper distribution.

The re-seal step in `afterCompleteHook` (which adds the blocker helper after signing) explicitly passes
`--entitlements` to preserve `com.apple.security.cs.allow-jit`. Without this, V8 cannot JIT compile
and Electron crashes at startup before any app code runs.

---

## Architecture: arm64 only (Apple Silicon)

Currently building for `arm64` only — M1/M2/M3/M4 Macs.

**To add Intel (x64) support:**
- Change `arch` in `forge.config.js` from `arm64` to `x64` (or `universal` for a fat binary that runs on both)
- `universal` doubles the DMG size (~250MB) but one file works everywhere
- Native modules (`better-sqlite3`, `active-win`, `keytar`) must be compiled for both architectures — run `npm rebuild` with the target arch, or use `electron-rebuild` with `--arch x64`
- The blocker helper binary also needs to be a universal binary or you ship two DMGs

For now: arm64 only is fine. Add Intel when you have Intel beta users.

---

## Output files

```
out/Promethee-darwin-arm64/Promethee.app    ← signed (not stapled)
out/make/Promethee-<version>.dmg            ← signed + notarized + stapled, drag-to-Applications layout
```

GitHub Release download URL:
```
https://github.com/mironpuzanov/Promethee/releases/download/v<version>/Promethee-<version>.dmg
```

> The GitHub repo is private. Beta users need to be added as repo collaborators, or the DMG should be hosted on a public S3/R2 bucket or a separate public `promethee-releases` repo.

> Supabase Storage has a 50MB free-tier limit. The DMG is ~130MB, so binaries go to GitHub Releases. Supabase only stores the update manifest row.

---

## How native modules work in the packaged app

`better-sqlite3`, `active-win`, and `keytar` are native Node modules — they have compiled `.node` binaries that can't be inside an asar archive.

The forge pipeline handles this in two stages:

1. **`afterCopyHook`** (fires before asar packing): copies the full module directories from the project's `node_modules/` into `buildPath/node_modules/` so they exist in the source tree
2. **`asar.unpack` glob**: when `asarApp()` packs the source, it matches `node_modules/{better-sqlite3,active-win,keytar,...}/**` and extracts those directories to `app.asar.unpacked/node_modules/`

Electron transparently redirects `require('better-sqlite3')` to `app.asar.unpacked/node_modules/better-sqlite3`.

Verify after a build:
```bash
ls out/Promethee-darwin-arm64/Promethee.app/Contents/Resources/app.asar.unpacked/node_modules/
# Should show: active-win  better-sqlite3  keytar
```

---

## How update delivery works

In packaged builds (`app.isPackaged === true`), the app:
1. Checks Supabase for a newer version on launch
2. Rechecks every 12 hours while running
3. When a newer version is found, shows a banner: "Promethee vX.X.X is available"
4. Clicking the banner opens the DMG download URL in the browser

No silent downloads. No auto-install. Manual reinstall for now — good enough for beta.

Update check does NOT run in dev (`npm start`) — only in packaged builds.

---

## Related files

- [forge.config.js](../forge.config.js) — build config: signing, asar unpacking, native module injection, blocker helper, entitlements re-seal
- [scripts/release.sh](../scripts/release.sh) — end-to-end release automation
- [scripts/publish-app-update.mjs](../scripts/publish-app-update.mjs) — Supabase manifest publisher
- [src/main/updateCheck.js](../src/main/updateCheck.js) — in-app update check logic
- [docs/app-updates.md](./app-updates.md) — update system technical reference
