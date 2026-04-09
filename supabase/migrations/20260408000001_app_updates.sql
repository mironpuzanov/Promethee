-- Public update manifest for Promethee packaged builds.
-- The app reads the active row for its platform/channel via the anon key.

CREATE TABLE IF NOT EXISTS app_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('darwin', 'win32', 'linux', 'all')),
  channel TEXT NOT NULL DEFAULT 'stable',
  version TEXT NOT NULL,
  download_url TEXT NOT NULL,
  release_url TEXT,
  asset_name TEXT,
  notes TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_updates_lookup
  ON app_updates (channel, platform, active, published_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_updates_one_active_per_platform
  ON app_updates (channel, platform)
  WHERE active = TRUE;

CREATE OR REPLACE FUNCTION set_app_updates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_updates_updated_at ON app_updates;
CREATE TRIGGER trg_app_updates_updated_at
BEFORE UPDATE ON app_updates
FOR EACH ROW
EXECUTE FUNCTION set_app_updates_updated_at();

ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active app updates" ON app_updates;
CREATE POLICY "public read active app updates"
ON app_updates
FOR SELECT
TO anon, authenticated
USING (active = TRUE);
