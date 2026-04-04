-- Quests table
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mid' CHECK (type IN ('daily', 'mid', 'long')),
  xp_reward INTEGER NOT NULL DEFAULT 50,
  completed_at BIGINT,          -- null = not yet completed
  reset_interval TEXT,          -- 'daily' for daily habit quests, null for others
  last_reset_date TEXT,         -- YYYY-MM-DD, used for daily reset logic
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- RLS
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own quests" ON quests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own quests" ON quests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own quests" ON quests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users delete own quests" ON quests
  FOR DELETE USING (auth.uid() = user_id);

-- Add streak tracking columns to user_profile (if not already present)
ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_session_date TEXT,        -- YYYY-MM-DD
  ADD COLUMN IF NOT EXISTS last_daily_job_date TEXT;      -- YYYY-MM-DD
