-- User profiles
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  discord_id TEXT UNIQUE,
  display_name TEXT,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Sessions (forward-compatible with Real v1 passive tracking)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  task TEXT,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  duration_seconds INTEGER,
  xp_earned INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',     -- 'manual' | 'passive' (Real v1)
  app_context JSONB,                -- [{app, window, seconds}] (Real v1)
  synced_at BIGINT,                 -- null = pending sync
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Leaderboard view (this week's XP)
CREATE OR REPLACE VIEW leaderboard_weekly AS
SELECT
  up.id,
  up.display_name,
  up.total_xp,
  COALESCE(SUM(s.xp_earned), 0) AS weekly_xp,
  RANK() OVER (ORDER BY COALESCE(SUM(s.xp_earned), 0) DESC) AS rank
FROM user_profile up
LEFT JOIN sessions s ON s.user_id = up.id
  AND s.ended_at IS NOT NULL
  AND s.started_at >= EXTRACT(EPOCH FROM DATE_TRUNC('week', NOW()))::BIGINT
GROUP BY up.id, up.display_name, up.total_xp;

-- RLS: users can only read/write their own data
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own profile" ON user_profile
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users update own profile" ON user_profile
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users insert own profile" ON user_profile
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users read own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Leaderboard is public (anyone can see weekly rankings)
CREATE POLICY "leaderboard public read" ON user_profile
  FOR SELECT USING (true);

-- Seed: 20 mock users for leaderboard demo
INSERT INTO user_profile (id, display_name, total_xp) VALUES
  ('00000000-0000-0000-0000-000000000001', 'atlas_grinds', 4820),
  ('00000000-0000-0000-0000-000000000002', 'nocturne', 4210),
  ('00000000-0000-0000-0000-000000000003', 'veilbreaker', 3990),
  ('00000000-0000-0000-0000-000000000004', 'ironveil', 3750),
  ('00000000-0000-0000-0000-000000000005', 'dawnseeker', 3400),
  ('00000000-0000-0000-0000-000000000006', 'obsidian_', 3100),
  ('00000000-0000-0000-0000-000000000007', 'meridian7', 2980),
  ('00000000-0000-0000-0000-000000000008', 'solstice', 2750),
  ('00000000-0000-0000-0000-000000000009', 'axiom_work', 2500),
  ('00000000-0000-0000-0000-000000000010', 'phantom_fx', 2200),
  ('00000000-0000-0000-0000-000000000011', 'crestfall', 2050),
  ('00000000-0000-0000-0000-000000000012', 'zenith_run', 1900),
  ('00000000-0000-0000-0000-000000000013', 'veritas_x', 1750),
  ('00000000-0000-0000-0000-000000000014', 'coldfront', 1600),
  ('00000000-0000-0000-0000-000000000015', 'praxis_one', 1450),
  ('00000000-0000-0000-0000-000000000016', 'luminara', 1300),
  ('00000000-0000-0000-0000-000000000017', 'stormgate', 1150),
  ('00000000-0000-0000-0000-000000000018', 'blackthorn', 1000),
  ('00000000-0000-0000-0000-000000000019', 'ashforge', 850),
  ('00000000-0000-0000-0000-000000000020', 'novahawk', 700)
ON CONFLICT DO NOTHING;
