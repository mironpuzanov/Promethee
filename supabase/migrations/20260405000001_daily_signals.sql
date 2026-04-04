-- Daily AI signals table
-- One row per user per calendar day.
-- Generated on first app open of each day via runDailyJobs().
CREATE TABLE IF NOT EXISTS daily_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  date TEXT NOT NULL,             -- YYYY-MM-DD local date
  content TEXT NOT NULL,          -- The signal message text
  intensity TEXT NOT NULL DEFAULT 'low' CHECK (intensity IN ('low', 'med', 'high')),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE (user_id, date)
);

ALTER TABLE daily_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own signals" ON daily_signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own signals" ON daily_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own signals" ON daily_signals
  FOR UPDATE USING (auth.uid() = user_id);
