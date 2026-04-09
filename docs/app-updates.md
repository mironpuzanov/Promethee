# App Updates

Promethee currently uses a **Supabase-backed update manifest**.

This is not a full auto-updater yet.

What exists today:

- packaged app checks Supabase for the latest active version
- app compares that version to `app.getVersion()`
- if newer exists, user sees an in-app prompt
- clicking `Download update` opens the download URL
- user installs the new build manually

What does **not** exist yet:

- background download
- `quitAndInstall`
- delta patching
- silent updates

## How it works

The main process reads the public `app_updates` table in Supabase from [updateCheck.js](../src/main/updateCheck.js).

The query looks for:

- `channel = stable`
- `active = true`
- `platform IN (<current platform>, all)`

If a row is found:

- `version` is compared to the current app version
- `download_url` is used for the update CTA
- `release_url` is used as fallback

The UI lives in:

- [index.tsx](../src/renderer/components/FullWindow/index.tsx)
- [SettingsTab.tsx](../src/renderer/components/FullWindow/SettingsTab.tsx)

## Supabase schema

The table was added in [20260408000001_app_updates.sql](../supabase/migrations/20260408000001_app_updates.sql).

Important fields:

- `platform`
- `channel`
- `version`
- `download_url`
- `release_url`
- `asset_name`
- `notes`
- `is_mandatory`
- `active`
- `published_at`

RLS allows public read of active rows only.

## Publish a new update

Use the helper script:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run publish:update -- \
  --platform darwin \
  --version 1.1.1 \
  --download-url https://downloads.promethee.app/Promethee-1.1.1.dmg \
  --release-url https://promethee.app/releases/1.1.1 \
  --notes "Fixes auth restore and permission flow"
```

What the script does:

1. deactivates the current active row for that `platform + channel`
2. inserts the new active row

The script is:

- [publish-app-update.mjs](../scripts/publish-app-update.mjs)

## Required env

Required:

- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `SUPABASE_URL`

If `SUPABASE_URL` is not set, it defaults to the current project URL from [supabase.js](../src/lib/supabase.js).

## Notes

- Dev mode does not auto-prompt on startup. Manual checks still work.
- The updater path no longer depends on public GitHub Releases.
- This works even if the GitHub repo stays private.
- For a polished external distribution flow, you still want proper macOS signing and notarization.
