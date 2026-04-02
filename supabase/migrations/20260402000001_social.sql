-- Rooms: named workspaces users can join during a session
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,             -- 'deep-work' | 'study' | 'creative'
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT
);

INSERT INTO rooms (id, name, description, icon) VALUES
  ('deep-work', 'Deep Work', 'No distractions. Build serious things.', '🔥'),
  ('study', 'Study', 'Learning mode. Books open, brain on.', '📚'),
  ('creative', 'Creative', 'Design, writing, music, art.', '🎨')
ON CONFLICT DO NOTHING;

-- Add room_id to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS room_id TEXT REFERENCES rooms(id);

-- Presence: heartbeat table (upserted every 30s while a session is active)
CREATE TABLE IF NOT EXISTS presence (
  user_id UUID PRIMARY KEY REFERENCES user_profile(id) ON DELETE CASCADE,
  display_name TEXT,
  room_id TEXT REFERENCES rooms(id),
  task TEXT,
  last_seen BIGINT NOT NULL,     -- epoch ms
  session_started_at BIGINT      -- when this session started
);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can upsert their own presence
CREATE POLICY "users upsert own presence" ON presence
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Presence is public (needed to show "X people working now")
CREATE POLICY "presence public read" ON presence
  FOR SELECT USING (true);

-- Live feed: recent session starts (populated when a session begins)
CREATE TABLE IF NOT EXISTS live_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  display_name TEXT,
  task TEXT,
  room_id TEXT REFERENCES rooms(id),
  started_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

ALTER TABLE live_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own feed entries" ON live_feed
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Live feed is public (social layer)
CREATE POLICY "live feed public read" ON live_feed
  FOR SELECT USING (true);

-- Only keep 48h of feed entries (cleanup handled by app, not DB trigger for simplicity)
