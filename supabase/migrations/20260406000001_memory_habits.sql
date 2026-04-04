-- 90-day memory snapshots
-- One row per user per calendar day, populated by runDailyJobs().
CREATE TABLE IF NOT EXISTS memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,            -- YYYY-MM-DD local date
  behavioral_summary TEXT,                -- GPT-generated 1-paragraph summary
  emotional_tags TEXT[],                  -- e.g. ['focused','consistent']
  peak_hours TEXT,                        -- e.g. '09:00–11:00'
  avg_session_duration_minutes INTEGER,   -- rolling average session length
  top_skills JSONB,                       -- { rigueur: 42, volonte: 30, courage: 5 }
  quest_completion_rate NUMERIC(5,2),     -- 0.00–100.00
  streak_at_snapshot INTEGER,             -- current_streak value on this day
  session_count INTEGER,                  -- sessions logged this day
  total_minutes INTEGER,                  -- total focus minutes this day
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE memory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own snapshots" ON memory_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own snapshots" ON memory_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own snapshots" ON memory_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

-- Habits table
-- Separate from quests. Completion tracked by date, not XP.
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  last_completed_date TEXT,               -- YYYY-MM-DD of last completion
  current_streak INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users delete own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);
