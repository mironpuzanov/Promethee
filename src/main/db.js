import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db = null;

// Initialize database - call this after app is ready
export function initializeDatabase() {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'promethee.db');

  // Ensure the directory exists
  fs.mkdirSync(userDataPath, { recursive: true });

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER,
      xp_earned INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      app_context TEXT,
      synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      total_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      session_id TEXT REFERENCES sessions(id),
      system_prompt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES agent_chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_chats_user ON agent_chats(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_chat ON agent_messages(chat_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mid' CHECK(type IN ('daily', 'mid', 'long')),
      xp_reward INTEGER NOT NULL DEFAULT 50,
      completed_at INTEGER,
      reset_interval TEXT,
      last_reset_date TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quests_user ON quests(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS window_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT,
      app_name TEXT NOT NULL,
      window_title TEXT,
      recorded_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_window_events_user ON window_events(user_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_window_events_session ON window_events(session_id, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS session_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_session ON session_notes(session_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON session_notes(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS memory_snapshot_cache (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      behavioral_summary TEXT,
      emotional_tags TEXT,
      peak_hours TEXT,
      avg_session_duration_minutes INTEGER,
      top_skills TEXT,
      quest_completion_rate REAL,
      streak_at_snapshot INTEGER,
      session_count INTEGER,
      total_minutes INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, snapshot_date)
    );

    CREATE INDEX IF NOT EXISTS idx_memory_snapshot_cache_user
      ON memory_snapshot_cache(user_id, snapshot_date DESC);

    CREATE TABLE IF NOT EXISTS habits_cache (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      last_completed_date TEXT,
      current_streak INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE INDEX IF NOT EXISTS idx_habits_cache_user
      ON habits_cache(user_id, deleted, created_at ASC);
  `);

  // Add streak/daily-job columns to user_profile if they don't exist yet (idempotent)
  const colCheck = db.prepare(`PRAGMA table_info(user_profile)`).all();
  const colNames = colCheck.map(c => c.name);
  if (!colNames.includes('current_streak')) {
    db.exec(`ALTER TABLE user_profile ADD COLUMN current_streak INTEGER DEFAULT 0`);
  }
  if (!colNames.includes('last_session_date')) {
    db.exec(`ALTER TABLE user_profile ADD COLUMN last_session_date TEXT`);
  }
  if (!colNames.includes('last_daily_job_date')) {
    db.exec(`ALTER TABLE user_profile ADD COLUMN last_daily_job_date TEXT`);
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export { db };

// Helper functions
export function createSession(userId, task) {
  const database = getDb();
  const id = crypto.randomUUID();
  const startedAt = Date.now();

  const stmt = database.prepare(`
    INSERT INTO sessions (id, user_id, task, started_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, userId, task, startedAt);

  return { id, userId, task, startedAt };
}

export function endSession(sessionId, xpEarned, durationSeconds) {
  const database = getDb();
  const endedAt = Date.now();

  const stmt = database.prepare(`
    UPDATE sessions
    SET ended_at = ?, duration_seconds = ?, xp_earned = ?
    WHERE id = ?
  `);

  stmt.run(endedAt, durationSeconds, xpEarned, sessionId);

  return { endedAt, durationSeconds, xpEarned };
}

export function markSessionSynced(sessionId) {
  const database = getDb();
  const syncedAt = Date.now();

  const stmt = database.prepare(`
    UPDATE sessions
    SET synced_at = ?
    WHERE id = ?
  `);

  stmt.run(syncedAt, sessionId);
}

export function getUnsyncedSessions() {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM sessions
    WHERE synced_at IS NULL AND ended_at IS NOT NULL
  `);

  return stmt.all();
}

export function getSessions(userId, limit = 100) {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM sessions
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);

  return stmt.all(userId, limit);
}

/** Completed sessions since `sinceMs` (for skill scores — matches local Session log, not only Supabase sync). */
export function getCompletedSessionsForSkills(userId, sinceMs) {
  const database = getDb();
  return database.prepare(`
    SELECT duration_seconds, started_at FROM sessions
    WHERE user_id = ?
      AND started_at >= ?
      AND ended_at IS NOT NULL
      AND duration_seconds IS NOT NULL
    ORDER BY started_at DESC
  `).all(userId, sinceMs);
}

/** Completed sessions with start time in [startMs, endMs] (memory snapshot rolling window). */
export function getCompletedSessionsInRange(userId, startMs, endMs) {
  const database = getDb();
  return database.prepare(`
    SELECT task, duration_seconds, started_at FROM sessions
    WHERE user_id = ?
      AND started_at >= ?
      AND started_at <= ?
      AND ended_at IS NOT NULL
      AND duration_seconds IS NOT NULL
    ORDER BY started_at DESC
  `).all(userId, startMs, endMs);
}

export function getSessionById(sessionId) {
  const database = getDb();
  return database.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
}

export function getTodaysSessions(userId) {
  const database = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTimestamp = todayStart.getTime();

  const stmt = database.prepare(`
    SELECT * FROM sessions
    WHERE user_id = ? AND started_at >= ?
    ORDER BY started_at DESC
  `);

  return stmt.all(userId, todayStartTimestamp);
}

export function getUserProfile(userId) {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM user_profile WHERE id = ?
  `);

  return stmt.get(userId);
}

export function createOrUpdateUserProfile(userId, email, displayName) {
  const database = getDb();
  const existing = getUserProfile(userId);

  if (existing) {
    const stmt = database.prepare(`
      UPDATE user_profile
      SET email = ?, display_name = ?
      WHERE id = ?
    `);
    stmt.run(email, displayName, userId);
  } else {
    const stmt = database.prepare(`
      INSERT INTO user_profile (id, email, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, email, displayName, Date.now());
  }

  return getUserProfile(userId);
}

export function updateUserXP(userId, xpToAdd) {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE user_profile
    SET total_xp = total_xp + ?
    WHERE id = ?
  `);

  stmt.run(xpToAdd, userId);

  // Update level based on XP.
  // Total XP to reach the START of level N: (N-1)*N/2 * 100
  // (matches getLevelInfo in src/lib/xp.ts)
  const profile = getUserProfile(userId);
  if (!profile) {
    console.warn(`updateUserXP: no profile found for user ${userId} — level not updated`);
    return;
  }

  const totalXp = profile.total_xp;
  let newLevel = 1;
  const MAX_LEVEL = 1000;
  while (newLevel < MAX_LEVEL) {
    const xpToReachNext = newLevel * (newLevel + 1) / 2 * 100;
    if (xpToReachNext > totalXp) break;
    newLevel++;
  }
  const levelStmt = database.prepare(`
    UPDATE user_profile
    SET level = ?
    WHERE id = ?
  `);
  levelStmt.run(newLevel, userId);
}

// Window tracking functions

export function recordWindowEvent(userId, sessionId, appName, windowTitle) {
  const database = getDb();
  database.prepare(`
    INSERT INTO window_events (user_id, session_id, app_name, window_title, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, sessionId || null, appName, windowTitle || null, Date.now());
}

export function getWindowEvents(userId, { sinceMs, sessionId, limit = 200 } = {}) {
  const database = getDb();
  if (sessionId) {
    return database.prepare(`
      SELECT * FROM window_events WHERE user_id = ? AND session_id = ?
      ORDER BY recorded_at DESC LIMIT ?
    `).all(userId, sessionId, limit);
  }
  if (sinceMs) {
    return database.prepare(`
      SELECT * FROM window_events WHERE user_id = ? AND recorded_at >= ?
      ORDER BY recorded_at DESC LIMIT ?
    `).all(userId, sinceMs, limit);
  }
  return database.prepare(`
    SELECT * FROM window_events WHERE user_id = ?
    ORDER BY recorded_at DESC LIMIT ?
  `).all(userId, limit);
}

// Agent chat functions

export function getAgentChats(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT ac.* FROM agent_chats ac
    WHERE ac.user_id = ?
      AND EXISTS (SELECT 1 FROM agent_messages am WHERE am.chat_id = ac.id)
    ORDER BY ac.updated_at DESC
    LIMIT 50
  `).all(userId);
}

export function getOrCreateAgentChat(userId, title, sessionId, systemPrompt) {
  const database = getDb();
  // If session_id provided, reuse existing chat for that session
  if (sessionId) {
    const existing = database.prepare(`
      SELECT * FROM agent_chats WHERE user_id = ? AND session_id = ?
    `).get(userId, sessionId);
    if (existing) return existing;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO agent_chats (id, user_id, title, session_id, system_prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, sessionId || null, systemPrompt, now, now);

  return database.prepare(`SELECT * FROM agent_chats WHERE id = ?`).get(id);
}

export function createAgentChat(userId, title, sessionId, systemPrompt) {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO agent_chats (id, user_id, title, session_id, system_prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, sessionId || null, systemPrompt, now, now);

  return database.prepare(`SELECT * FROM agent_chats WHERE id = ?`).get(id);
}

export function getAgentMessages(chatId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM agent_messages
    WHERE chat_id = ?
    ORDER BY created_at ASC
    LIMIT 50
  `).all(chatId);
}

export function addAgentMessage(chatId, role, content) {
  const database = getDb();

  // Deduplicate: if the most recent message in this chat is the same role+content,
  // a retry is happening — return the existing row rather than inserting a duplicate.
  const last = database.prepare(`
    SELECT * FROM agent_messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(chatId);
  if (last && last.role === role && last.content === content) {
    return { id: last.id, chatId, role, content, createdAt: last.created_at };
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO agent_messages (id, chat_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, chatId, role, content, now);

  // Update chat updated_at
  database.prepare(`UPDATE agent_chats SET updated_at = ? WHERE id = ?`).run(now, chatId);

  return { id, chatId, role, content, createdAt: now };
}

// ── Quest functions ───────────────────────────────────────────────────────────

export function getQuests(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM quests WHERE user_id = ? ORDER BY created_at ASC
  `).all(userId);
}

export function createQuest(userId, title, type, xpReward) {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  // Default XP by type if not provided
  const xp = xpReward != null ? xpReward : (type === 'daily' ? 15 : type === 'mid' ? 50 : 200);
  const resetInterval = type === 'daily' ? 'daily' : null;
  database.prepare(`
    INSERT INTO quests (id, user_id, title, type, xp_reward, reset_interval, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, type, xp, resetInterval, now);
  return database.prepare(`SELECT * FROM quests WHERE id = ?`).get(id);
}

export function completeQuest(questId, userId) {
  const database = getDb();
  const quest = database.prepare(`SELECT * FROM quests WHERE id = ? AND user_id = ?`).get(questId, userId);
  if (!quest) return null;
  if (quest.completed_at) return quest; // already done
  const now = Date.now();
  database.prepare(`UPDATE quests SET completed_at = ? WHERE id = ?`).run(now, questId);
  return database.prepare(`SELECT * FROM quests WHERE id = ?`).get(questId);
}

export function uncompleteQuest(questId, userId) {
  const database = getDb();
  database.prepare(`UPDATE quests SET completed_at = NULL WHERE id = ? AND user_id = ?`).run(questId, userId);
  return database.prepare(`SELECT * FROM quests WHERE id = ?`).get(questId);
}

export function deleteQuest(questId, userId) {
  const database = getDb();
  database.prepare(`DELETE FROM quests WHERE id = ? AND user_id = ?`).run(questId, userId);
}

// ── Session task checklist (local SQLite only) ─────────────────────────────

export function createTask(sessionId, userId, text) {
  const database = getDb();
  const trimmed = (text && String(text).trim()) || '';
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = database.prepare(`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE session_id = ?
  `).get(sessionId);
  const position = row?.next ?? 0;
  database.prepare(`
    INSERT INTO tasks (id, session_id, user_id, text, completed, position, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, sessionId, userId, trimmed, position, now);
  return database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

export function getTasksBySession(sessionId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM tasks WHERE session_id = ? ORDER BY position ASC, created_at ASC
  `).all(sessionId);
}

export function getTasksByUser(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId);
}

export function toggleTask(taskId, userId) {
  const database = getDb();
  return database.transaction(() => {
    const task = database.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(taskId, userId);
    if (!task) return null;
    const next = task.completed ? 0 : 1;
    database.prepare(`UPDATE tasks SET completed = ? WHERE id = ?`).run(next, taskId);
    return database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
  })();
}

export function deleteTask(taskId, userId) {
  const database = getDb();
  const result = database.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).run(taskId, userId);
  return result.changes > 0;
}

// ── Session notes (quick capture during focus) ─────────────────────────────

export function createNote(sessionId, userId, text) {
  const database = getDb();
  const trimmed = (text && String(text).trim()) || '';
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO session_notes (id, session_id, user_id, text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, trimmed, now);
  return database.prepare(`SELECT * FROM session_notes WHERE id = ?`).get(id);
}

export function getNotesBySession(sessionId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM session_notes WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId);
}

export function getNotesByUser(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM session_notes WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId);
}

export function deleteNote(noteId, userId) {
  const database = getDb();
  const result = database.prepare(`DELETE FROM session_notes WHERE id = ? AND user_id = ?`).run(noteId, userId);
  return result.changes > 0;
}

// Reset daily quests whose last_reset_date != today's local date
// Returns array of quest IDs that were reset
export function resetDailyQuests(userId, todayDateStr) {
  const database = getDb();
  const dailyQuests = database.prepare(`
    SELECT * FROM quests WHERE user_id = ? AND type = 'daily' AND completed_at IS NOT NULL
  `).all(userId);

  const reset = [];
  for (const q of dailyQuests) {
    if (q.last_reset_date !== todayDateStr) {
      database.prepare(`
        UPDATE quests SET completed_at = NULL, last_reset_date = ? WHERE id = ?
      `).run(todayDateStr, q.id);
      reset.push(q.id);
    }
  }
  return reset;
}

// Update the last_daily_job_date in user_profile
export function setLastDailyJobDate(userId, dateStr) {
  const database = getDb();
  database.prepare(`UPDATE user_profile SET last_daily_job_date = ? WHERE id = ?`).run(dateStr, userId);
}

export function getLastDailyJobDate(userId) {
  const database = getDb();
  const profile = database.prepare(`SELECT last_daily_job_date FROM user_profile WHERE id = ?`).get(userId);
  return profile?.last_daily_job_date || null;
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapMemorySnapshotCacheRow(row) {
  return {
    ...row,
    emotional_tags: parseJsonField(row.emotional_tags, []),
    top_skills: parseJsonField(row.top_skills, null),
  };
}

export function getMemorySnapshotCache(userId, limit = 90) {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM memory_snapshot_cache
    WHERE user_id = ?
    ORDER BY snapshot_date DESC
    LIMIT ?
  `).all(userId, limit);
  return rows.map(mapMemorySnapshotCacheRow);
}

export function getMemorySnapshotCacheByDate(userId, snapshotDate) {
  const database = getDb();
  const row = database.prepare(`
    SELECT * FROM memory_snapshot_cache
    WHERE user_id = ? AND snapshot_date = ?
  `).get(userId, snapshotDate);
  return row ? mapMemorySnapshotCacheRow(row) : null;
}

export function upsertMemorySnapshotCache(userId, snapshot) {
  const database = getDb();
  const existing = database.prepare(`
    SELECT id, created_at FROM memory_snapshot_cache
    WHERE user_id = ? AND snapshot_date = ?
  `).get(userId, snapshot.snapshot_date);
  const id = existing?.id || snapshot.id || crypto.randomUUID();
  const createdAt = snapshot.created_at ?? existing?.created_at ?? Date.now();

  database.prepare(`
    INSERT INTO memory_snapshot_cache (
      id, user_id, snapshot_date, behavioral_summary, emotional_tags, peak_hours,
      avg_session_duration_minutes, top_skills, quest_completion_rate,
      streak_at_snapshot, session_count, total_minutes, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
      behavioral_summary = excluded.behavioral_summary,
      emotional_tags = excluded.emotional_tags,
      peak_hours = excluded.peak_hours,
      avg_session_duration_minutes = excluded.avg_session_duration_minutes,
      top_skills = excluded.top_skills,
      quest_completion_rate = excluded.quest_completion_rate,
      streak_at_snapshot = excluded.streak_at_snapshot,
      session_count = excluded.session_count,
      total_minutes = excluded.total_minutes,
      created_at = excluded.created_at
  `).run(
    id,
    userId,
    snapshot.snapshot_date,
    snapshot.behavioral_summary ?? null,
    JSON.stringify(snapshot.emotional_tags || []),
    snapshot.peak_hours ?? null,
    snapshot.avg_session_duration_minutes ?? null,
    snapshot.top_skills ? JSON.stringify(snapshot.top_skills) : null,
    snapshot.quest_completion_rate ?? null,
    snapshot.streak_at_snapshot ?? 0,
    snapshot.session_count ?? 0,
    snapshot.total_minutes ?? 0,
    createdAt
  );

  return getMemorySnapshotCacheByDate(userId, snapshot.snapshot_date);
}

function mapHabitCacheRow(row) {
  if (!row || row.deleted) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    frequency: row.frequency,
    last_completed_date: row.last_completed_date,
    current_streak: row.current_streak,
    created_at: row.created_at,
  };
}

export function listHabitCache(userId) {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM habits_cache
    WHERE user_id = ? AND deleted = 0
    ORDER BY created_at ASC
  `).all(userId);
  return rows.map(mapHabitCacheRow).filter(Boolean);
}

export function getHabitCacheById(userId, habitId) {
  const database = getDb();
  const row = database.prepare(`
    SELECT * FROM habits_cache
    WHERE user_id = ? AND id = ?
  `).get(userId, habitId);
  return mapHabitCacheRow(row);
}

export function upsertHabitCache(userId, habit, syncState = 'synced') {
  const database = getDb();
  const now = Date.now();
  const createdAt = habit.created_at ?? now;
  const updatedAt = habit.updated_at ?? now;

  database.prepare(`
    INSERT INTO habits_cache (
      id, user_id, title, frequency, last_completed_date,
      current_streak, created_at, updated_at, deleted, sync_state
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      frequency = excluded.frequency,
      last_completed_date = excluded.last_completed_date,
      current_streak = excluded.current_streak,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted = excluded.deleted,
      sync_state = excluded.sync_state
  `).run(
    habit.id,
    userId,
    habit.title,
    habit.frequency || 'daily',
    habit.last_completed_date ?? null,
    habit.current_streak ?? 0,
    createdAt,
    updatedAt,
    habit.deleted ? 1 : 0,
    syncState
  );

  return getHabitCacheById(userId, habit.id);
}

export function markHabitCacheDeleted(userId, habitId) {
  const database = getDb();
  database.prepare(`
    UPDATE habits_cache
    SET deleted = 1, sync_state = 'pending_delete', updated_at = ?
    WHERE user_id = ? AND id = ?
  `).run(Date.now(), userId, habitId);
}

export function removeHabitCache(userId, habitId) {
  const database = getDb();
  database.prepare(`
    DELETE FROM habits_cache WHERE user_id = ? AND id = ?
  `).run(userId, habitId);
}

export function setHabitCacheSyncState(userId, habitId, syncState) {
  const database = getDb();
  database.prepare(`
    UPDATE habits_cache
    SET sync_state = ?, updated_at = ?
    WHERE user_id = ? AND id = ?
  `).run(syncState, Date.now(), userId, habitId);
}

export function getPendingHabitCache(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM habits_cache
    WHERE user_id = ? AND sync_state != 'synced'
    ORDER BY updated_at ASC
  `).all(userId);
}

// Streak helpers
export function updateStreak(userId, todayDateStr) {
  const database = getDb();
  const profile = database.prepare(`SELECT current_streak, last_session_date FROM user_profile WHERE id = ?`).get(userId);
  if (!profile) return 0;

  const last = profile.last_session_date;
  let streak = profile.current_streak || 0;

  if (last === todayDateStr) {
    // Already counted today
    return streak;
  }

  // Check if yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA'); // YYYY-MM-DD

  if (last === yesterdayStr) {
    streak += 1;
  } else {
    streak = 1; // broke streak
  }

  database.prepare(`
    UPDATE user_profile SET current_streak = ?, last_session_date = ? WHERE id = ?
  `).run(streak, todayDateStr, userId);

  return streak;
}
