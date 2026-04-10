-- Sync all local-only tables to Supabase for cross-device restore.
-- All tables use RLS: users can only read/write their own rows.

-- ─── agent_chats ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_chats (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  summary TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

ALTER TABLE agent_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chats" ON agent_chats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own chats" ON agent_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own chats" ON agent_chats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own chats" ON agent_chats
  FOR DELETE USING (auth.uid() = user_id);

-- ─── agent_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES agent_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own messages" ON agent_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own messages" ON agent_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own messages" ON agent_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ─── tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER,
  created_at BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ─── session_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notes" ON session_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own notes" ON session_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own notes" ON session_notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own notes" ON session_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ─── habit_completions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date TEXT NOT NULL,  -- YYYY-MM-DD
  created_at BIGINT NOT NULL,
  UNIQUE (user_id, habit_id, completed_date)
);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own completions" ON habit_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own completions" ON habit_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own completions" ON habit_completions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── window_events ───────────────────────────────────────────────────────────
-- High-volume table: synced in batches, not per-event.
-- Local id is AUTOINCREMENT INTEGER; we use a UUID column for Supabase PK.
CREATE TABLE IF NOT EXISTS window_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  app_name TEXT NOT NULL,
  window_title TEXT,
  recorded_at BIGINT NOT NULL
);

ALTER TABLE window_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_window_events_user ON window_events (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_window_events_session ON window_events (session_id, recorded_at DESC);

CREATE POLICY "users read own window events" ON window_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own window events" ON window_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own window events" ON window_events
  FOR DELETE USING (auth.uid() = user_id);
