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

    CREATE TABLE IF NOT EXISTS habit_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      habit_id TEXT NOT NULL,
      completed_date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, habit_id, completed_date)
    );

    CREATE INDEX IF NOT EXISTS idx_habit_completions_user
      ON habit_completions(user_id, completed_date DESC);

    CREATE TABLE IF NOT EXISTS blocked_domains (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      preset INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocker_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      domain TEXT NOT NULL,
      blocked_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'network_filter'
    );
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
  if (!colNames.includes('telegram_chat_id')) {
    db.exec(`ALTER TABLE user_profile ADD COLUMN telegram_chat_id TEXT`);
  }

  // Migration: add summary column to agent_chats
  const chatColCheck = db.prepare(`PRAGMA table_info(agent_chats)`).all();
  const chatColNames = chatColCheck.map(c => c.name);
  if (!chatColNames.includes('summary')) {
    db.exec(`ALTER TABLE agent_chats ADD COLUMN summary TEXT`);
  }

  // Migration: make tasks.session_id nullable (SQLite requires table recreation)
  // Detect by checking the notnull constraint on session_id column
  const tasksInfo = db.prepare(`PRAGMA table_info(tasks)`).all();
  const sessionIdCol = tasksInfo.find(c => c.name === 'session_id');
  if (sessionIdCol && sessionIdCol.notnull === 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks_new (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        xp_reward INTEGER,
        created_at INTEGER NOT NULL
      );
      INSERT INTO tasks_new (id, session_id, user_id, text, completed, position, created_at)
        SELECT id, session_id, user_id, text, completed, position, created_at FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, created_at DESC);
    `);
  } else {
    // tasks table already nullable — ensure xp_reward column exists
    const hasXpReward = tasksInfo.some(c => c.name === 'xp_reward');
    if (!hasXpReward) {
      db.exec(`ALTER TABLE tasks ADD COLUMN xp_reward INTEGER`);
    }
  }


  // Migration: add sync columns to tasks
  const tasksInfo2 = db.prepare(`PRAGMA table_info(tasks)`).all();
  const tasksColNames = tasksInfo2.map(c => c.name);
  if (!tasksColNames.includes('deleted')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`);
  }
  if (!tasksColNames.includes('sync_state')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending_upsert'`);
  }

  // Migration: add sync columns to session_notes
  const notesInfo = db.prepare(`PRAGMA table_info(session_notes)`).all();
  const notesColNames = notesInfo.map(c => c.name);
  if (!notesColNames.includes('deleted')) {
    db.exec(`ALTER TABLE session_notes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`);
  }
  if (!notesColNames.includes('sync_state')) {
    db.exec(`ALTER TABLE session_notes ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending_upsert'`);
  }

  // Migration: add uuid + synced_at to window_events for batch Supabase sync
  const weInfo = db.prepare(`PRAGMA table_info(window_events)`).all();
  const weColNames = weInfo.map(c => c.name);
  if (!weColNames.includes('uuid')) {
    db.exec(`ALTER TABLE window_events ADD COLUMN uuid TEXT`);
  }
  if (!weColNames.includes('synced_at')) {
    db.exec(`ALTER TABLE window_events ADD COLUMN synced_at INTEGER`);
  }

  // Migration: add user_id to agent_messages (needed for RLS-compatible sync)
  const amInfo = db.prepare(`PRAGMA table_info(agent_messages)`).all();
  const amColNames = amInfo.map(c => c.name);
  if (!amColNames.includes('user_id')) {
    db.exec(`ALTER TABLE agent_messages ADD COLUMN user_id TEXT`);
    // Backfill user_id from parent chat
    db.exec(`
      UPDATE agent_messages
      SET user_id = (SELECT user_id FROM agent_chats WHERE agent_chats.id = agent_messages.chat_id)
      WHERE user_id IS NULL
    `);
  }

  // Migration: add sync_state to agent_chats
  const chatColCheck2 = db.prepare(`PRAGMA table_info(agent_chats)`).all();
  const chatColNames2 = chatColCheck2.map(c => c.name);
  if (!chatColNames2.includes('sync_state')) {
    db.exec(`ALTER TABLE agent_chats ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending_upsert'`);
  }

  // Seed default preset blocked domains on first init (idempotent via UNIQUE constraint)
  const presetDomains = ['x.com', 'twitter.com', 'instagram.com', 'youtube.com', 'reddit.com', 'tiktok.com'];
  const insertPreset = db.prepare(`
    INSERT OR IGNORE INTO blocked_domains (id, domain, enabled, preset, position, created_at, updated_at)
    VALUES (?, ?, 1, 1, ?, ?, ?)
  `);
  const now = Date.now();
  presetDomains.forEach((domain, i) => {
    insertPreset.run(crypto.randomUUID(), domain, i, now, now);
  });

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

// Restore user profile stats from Supabase on login/session restore.
// Only writes fields where the remote value is higher — never downgrades local data.
export function restoreUserProfileFromRemote(userId, remote) {
  const database = getDb();
  const local = getUserProfile(userId);
  if (!local) return; // createOrUpdateUserProfile must be called first

  const remoteXp = remote.total_xp || 0;
  const remoteLevel = remote.level || 1;
  const remoteStreak = remote.current_streak || 0;
  const remoteLastSession = remote.last_session_date || null;

  // Take the maximum of local and remote for XP and level
  const newXp = Math.max(local.total_xp || 0, remoteXp);
  const newLevel = Math.max(local.level || 1, remoteLevel);
  // For streak, prefer remote if local is 0 (fresh install) or remote is higher
  const newStreak = (local.current_streak || 0) === 0 ? remoteStreak : Math.max(local.current_streak, remoteStreak);
  // For last_session_date, keep the most recent
  const newLastSession = (!local.last_session_date && remoteLastSession)
    ? remoteLastSession
    : (local.last_session_date && remoteLastSession)
      ? (local.last_session_date > remoteLastSession ? local.last_session_date : remoteLastSession)
      : local.last_session_date;

  database.prepare(`
    UPDATE user_profile
    SET total_xp = ?, level = ?, current_streak = ?, last_session_date = ?
    WHERE id = ?
  `).run(newXp, newLevel, newStreak, newLastSession, userId);
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
    INSERT INTO agent_chats (id, user_id, title, session_id, system_prompt, created_at, updated_at, sync_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_upsert')
  `).run(id, userId, title, sessionId || null, systemPrompt, now, now);

  return database.prepare(`SELECT * FROM agent_chats WHERE id = ?`).get(id);
}

export function createAgentChat(userId, title, sessionId, systemPrompt) {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO agent_chats (id, user_id, title, session_id, system_prompt, created_at, updated_at, sync_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_upsert')
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
  // Look up user_id from parent chat for RLS-compatible sync
  const chat = database.prepare(`SELECT user_id FROM agent_chats WHERE id = ?`).get(chatId);
  database.prepare(`
    INSERT INTO agent_messages (id, chat_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, chatId, chat?.user_id || null, role, content, now);

  // Update chat updated_at and mark pending so the summary gets re-synced
  database.prepare(`UPDATE agent_chats SET updated_at = ?, sync_state = 'pending_upsert' WHERE id = ?`).run(now, chatId);

  return { id, chatId, role, content, createdAt: now };
}

export function updateChatSummary(chatId, summary) {
  const database = getDb();
  database.prepare(`UPDATE agent_chats SET summary = ? WHERE id = ?`).run(summary, chatId);
}

export function getUnsummarizedChats(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT ac.id FROM agent_chats ac
    WHERE ac.user_id = ? AND ac.summary IS NULL
      AND EXISTS (SELECT 1 FROM agent_messages am WHERE am.chat_id = ac.id)
    ORDER BY ac.updated_at DESC
    LIMIT 20
  `).all(userId);
}

export function getRecentChatSummaries(userId, excludeChatId, limit = 3) {
  const database = getDb();
  return database.prepare(`
    SELECT id, title, summary, updated_at FROM agent_chats
    WHERE user_id = ? AND id != ? AND summary IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(userId, excludeChatId, limit);
}

// ── Quest functions ───────────────────────────────────────────────────────────

// Quests were migrated to tasks — these stubs prevent crashes from old IPC handlers.
export function getQuests(_userId) { return []; }
export function createQuest(_userId, _title, _type, _xpReward) { return null; }
export function completeQuest(_questId, _userId) { return null; }
export function uncompleteQuest(_questId, _userId) { return null; }
export function deleteQuest(_questId, _userId) {}

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
    INSERT INTO tasks (id, session_id, user_id, text, completed, position, created_at, sync_state)
    VALUES (?, ?, ?, ?, 0, ?, ?, 'pending_upsert')
  `).run(id, sessionId, userId, trimmed, position, now);
  return database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

export function createStandaloneTask(userId, text, xpReward) {
  const database = getDb();
  const trimmed = (text && String(text).trim()) || '';
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = database.prepare(`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE session_id IS NULL AND user_id = ?
  `).get(userId);
  const position = row?.next ?? 0;
  const xp = xpReward && Number(xpReward) > 0 ? Math.round(Number(xpReward)) : null;
  database.prepare(`
    INSERT INTO tasks (id, session_id, user_id, text, completed, position, xp_reward, created_at, sync_state)
    VALUES (?, NULL, ?, ?, 0, ?, ?, ?, 'pending_upsert')
  `).run(id, userId, trimmed, position, xp, now);
  return database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

export function getTasksBySession(sessionId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM tasks WHERE session_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY position ASC, created_at ASC
  `).all(sessionId);
}

export function getTasksByUser(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM tasks WHERE user_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at DESC
  `).all(userId);
}

export function toggleTask(taskId, userId) {
  const database = getDb();
  return database.transaction(() => {
    const task = database.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(taskId, userId);
    if (!task) return null;
    const next = task.completed ? 0 : 1;
    database.prepare(`UPDATE tasks SET completed = ?, sync_state = 'pending_upsert' WHERE id = ?`).run(next, taskId);
    return database.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
  })();
}

export function deleteTask(taskId, userId) {
  const database = getDb();
  // Soft-delete so Supabase sync can propagate the deletion
  database.prepare(`UPDATE tasks SET deleted = 1, sync_state = 'pending_delete' WHERE id = ? AND user_id = ?`).run(taskId, userId);
  return true;
}

// ── Session notes (quick capture during focus) ─────────────────────────────

export function createNote(sessionId, userId, text) {
  const database = getDb();
  const trimmed = (text && String(text).trim()) || '';
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  database.prepare(`
    INSERT INTO session_notes (id, session_id, user_id, text, created_at, sync_state)
    VALUES (?, ?, ?, ?, ?, 'pending_upsert')
  `).run(id, sessionId, userId, trimmed, now);
  return database.prepare(`SELECT * FROM session_notes WHERE id = ?`).get(id);
}

export function getNotesBySession(sessionId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM session_notes WHERE session_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at ASC
  `).all(sessionId);
}

export function getNotesByUser(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM session_notes WHERE user_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at DESC
  `).all(userId);
}

export function deleteNote(noteId, userId) {
  const database = getDb();
  // Soft-delete so Supabase sync can propagate the deletion
  database.prepare(`UPDATE session_notes SET deleted = 1, sync_state = 'pending_delete' WHERE id = ? AND user_id = ?`).run(noteId, userId);
  return true;
}

// Reset daily quests — quests were migrated to tasks, no-op kept for compatibility
export function resetDailyQuests(_userId, _todayDateStr) {
  return [];
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

// ── Habit completions (per-day history) ───────────────────────────────────────

export function recordHabitCompletion(userId, habitId, completedDate) {
  const database = getDb();
  database.prepare(`
    INSERT OR IGNORE INTO habit_completions (id, user_id, habit_id, completed_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, habitId, completedDate, Date.now());
}

export function removeHabitCompletion(userId, habitId, completedDate) {
  const database = getDb();
  database.prepare(`
    DELETE FROM habit_completions WHERE user_id = ? AND habit_id = ? AND completed_date = ?
  `).run(userId, habitId, completedDate);
}

/** Returns completed_date strings for a habit in the last N days (inclusive). */
export function getHabitCompletionDates(userId, habitId, limitDays = 30) {
  const database = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');
  const rows = database.prepare(`
    SELECT completed_date FROM habit_completions
    WHERE user_id = ? AND habit_id = ? AND completed_date >= ?
    ORDER BY completed_date DESC
  `).all(userId, habitId, cutoffStr);
  return rows.map(r => r.completed_date);
}

/**
 * One-time backfill: for habits that have a streak but no completion records yet,
 * seed habit_completions by walking back from last_completed_date by current_streak days.
 * Idempotent — uses INSERT OR IGNORE so safe to call multiple times.
 */
export function backfillHabitCompletions(userId) {
  const database = getDb();
  const habits = database.prepare(`
    SELECT * FROM habits_cache WHERE user_id = ? AND deleted = 0 AND last_completed_date IS NOT NULL AND current_streak > 0
  `).all(userId);

  const insert = database.prepare(`
    INSERT OR IGNORE INTO habit_completions (id, user_id, habit_id, completed_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((rows) => {
    for (const row of rows) insert.run(row.id, row.userId, row.habitId, row.date, row.createdAt);
  });

  const rows = [];
  for (const h of habits) {
    // Check if already has any completion records
    const existing = database.prepare(
      `SELECT COUNT(*) as cnt FROM habit_completions WHERE user_id = ? AND habit_id = ?`
    ).get(userId, h.id);
    if (existing.cnt > 0) continue; // already seeded

    const streak = Math.min(h.current_streak, 90); // cap at 90 days to avoid abuse
    const base = new Date(h.last_completed_date + 'T12:00:00');
    for (let i = 0; i < streak; i++) {
      const d = new Date(base);
      if (h.frequency === 'daily') {
        d.setDate(base.getDate() - i);
      } else {
        // weekly: one per week going back
        d.setDate(base.getDate() - i * 7);
      }
      rows.push({
        id: crypto.randomUUID(),
        userId,
        habitId: h.id,
        date: d.toLocaleDateString('en-CA'),
        createdAt: Date.now(),
      });
    }
  }

  if (rows.length > 0) insertMany(rows);
  return rows.length;
}

/**
 * Expire streaks for habits that were not completed on time.
 * - daily: streak resets if last_completed_date < yesterday
 * - weekly: streak resets if last_completed_date is not in the current ISO week
 * Returns array of habit ids that were reset.
 */
export function expireHabitStreaks(userId) {
  const database = getDb();
  const habits = database.prepare(`
    SELECT * FROM habits_cache WHERE user_id = ? AND deleted = 0
  `).all(userId);

  const today = new Date();
  const todayStr = today.toLocaleDateString('en-CA');

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  // ISO week start (Monday)
  const weekStart = new Date(today);
  const day = weekStart.getDay(); // 0=Sun
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toLocaleDateString('en-CA');

  const reset = [];
  const stmt = database.prepare(`
    UPDATE habits_cache SET current_streak = 0, updated_at = ? WHERE user_id = ? AND id = ?
  `);

  for (const h of habits) {
    if (!h.last_completed_date || h.current_streak === 0) continue;
    let shouldReset = false;

    if (h.frequency === 'daily') {
      // Missed yesterday and not completed today
      shouldReset = h.last_completed_date < yesterdayStr && h.last_completed_date !== todayStr;
    } else if (h.frequency === 'weekly') {
      // Last completion was before this week started
      shouldReset = h.last_completed_date < weekStartStr;
    }

    if (shouldReset) {
      stmt.run(Date.now(), userId, h.id);
      reset.push(h.id);
    }
  }

  return reset;
}

// ── Blocked domains ────────────────────────────────────────────────────────────

export function getBlockedDomains() {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM blocked_domains ORDER BY position ASC, created_at ASC
  `).all();
}

export function addBlockedDomain(domain) {
  const database = getDb();
  const trimmed = (domain && String(domain).trim().toLowerCase()) || '';
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = database.prepare(`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM blocked_domains
  `).get();
  const position = row?.next ?? 0;
  try {
    database.prepare(`
      INSERT INTO blocked_domains (id, domain, enabled, preset, position, created_at, updated_at)
      VALUES (?, ?, 1, 0, ?, ?, ?)
    `).run(id, trimmed, position, now, now);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return { error: 'Domain already exists' };
    }
    throw e;
  }
  return database.prepare(`SELECT * FROM blocked_domains WHERE id = ?`).get(id);
}

export function toggleBlockedDomain(id, enabled) {
  const database = getDb();
  const now = Date.now();
  database.prepare(`
    UPDATE blocked_domains SET enabled = ?, updated_at = ? WHERE id = ?
  `).run(enabled ? 1 : 0, now, id);
  return database.prepare(`SELECT * FROM blocked_domains WHERE id = ?`).get(id);
}

export function removeBlockedDomain(id) {
  const database = getDb();
  const result = database.prepare(`DELETE FROM blocked_domains WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ── Sync helpers for agent_chats ──────────────────────────────────────────────

export function getPendingAgentChats(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM agent_chats
    WHERE user_id = ? AND sync_state != 'synced'
    ORDER BY updated_at ASC
  `).all(userId);
}

export function setAgentChatSyncState(chatId, syncState) {
  const database = getDb();
  database.prepare(`UPDATE agent_chats SET sync_state = ? WHERE id = ?`).run(syncState, chatId);
}

export function getPendingAgentMessages(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT am.*, ac.user_id
    FROM agent_messages am
    JOIN agent_chats ac ON ac.id = am.chat_id
    WHERE ac.user_id = ? AND (am.user_id IS NULL OR am.user_id = ?)
    AND NOT EXISTS (
      SELECT 1 FROM agent_chats c2 WHERE c2.id = am.chat_id AND c2.sync_state != 'synced'
    )
    ORDER BY am.created_at ASC
    LIMIT 200
  `).all(userId, userId);
}

// ── Sync helpers for tasks ────────────────────────────────────────────────────

export function getPendingTasks(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM tasks WHERE user_id = ? AND sync_state != 'synced'
    ORDER BY created_at ASC
  `).all(userId);
}

export function setTaskSyncState(taskId, syncState) {
  const database = getDb();
  database.prepare(`UPDATE tasks SET sync_state = ? WHERE id = ?`).run(syncState, taskId);
}

// ── Sync helpers for session_notes ────────────────────────────────────────────

export function getPendingNotes(userId) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM session_notes WHERE user_id = ? AND sync_state != 'synced'
    ORDER BY created_at ASC
  `).all(userId);
}

export function setNoteSyncState(noteId, syncState) {
  const database = getDb();
  database.prepare(`UPDATE session_notes SET sync_state = ? WHERE id = ?`).run(syncState, noteId);
}

// ── Sync helpers for habit_completions ───────────────────────────────────────

export function getUnsyncedHabitCompletions(userId) {
  const database = getDb();
  // completions that haven't been assigned a sync_state yet — track via synced_at-like approach
  // We use the absence of a synced marker. For simplicity, track via a synced_at column approach:
  // but we don't have that column. Instead, just sync all completions from the last 90 days.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');
  return database.prepare(`
    SELECT * FROM habit_completions
    WHERE user_id = ? AND completed_date >= ?
    ORDER BY completed_date DESC
  `).all(userId, cutoffStr);
}

// ── Sync helpers for window_events ────────────────────────────────────────────

export function getUnsyncedWindowEvents(userId, batchSize = 500) {
  const database = getDb();
  return database.prepare(`
    SELECT * FROM window_events
    WHERE user_id = ? AND synced_at IS NULL
    ORDER BY recorded_at ASC
    LIMIT ?
  `).all(userId, batchSize);
}

export function markWindowEventsSynced(ids) {
  if (!ids || ids.length === 0) return;
  const database = getDb();
  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');
  database.prepare(`
    UPDATE window_events SET synced_at = ? WHERE id IN (${placeholders})
  `).run(now, ...ids);
}

// ── Restore helpers (pull from Supabase into local SQLite on login) ───────────

export function upsertTaskFromRemote(task) {
  const database = getDb();
  database.prepare(`
    INSERT INTO tasks (id, session_id, user_id, text, completed, position, xp_reward, created_at, deleted, sync_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      completed = excluded.completed,
      position = excluded.position,
      xp_reward = excluded.xp_reward,
      deleted = excluded.deleted,
      sync_state = 'synced'
  `).run(
    task.id,
    task.session_id || null,
    task.user_id,
    task.text,
    task.completed ? 1 : 0,
    task.position ?? 0,
    task.xp_reward ?? null,
    task.created_at,
    task.deleted ? 1 : 0
  );
}

export function upsertNoteFromRemote(note) {
  const database = getDb();
  database.prepare(`
    INSERT INTO session_notes (id, session_id, user_id, text, created_at, deleted, sync_state)
    VALUES (?, ?, ?, ?, ?, ?, 'synced')
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      deleted = excluded.deleted,
      sync_state = 'synced'
  `).run(
    note.id,
    note.session_id || null,
    note.user_id,
    note.text,
    note.created_at,
    note.deleted ? 1 : 0
  );
}

export function upsertAgentChatFromRemote(chat) {
  const database = getDb();
  database.prepare(`
    INSERT INTO agent_chats (id, user_id, title, session_id, system_prompt, summary, created_at, updated_at, sync_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      sync_state = 'synced'
  `).run(
    chat.id,
    chat.user_id,
    chat.title,
    chat.session_id || null,
    chat.system_prompt || '',
    chat.summary || null,
    chat.created_at,
    chat.updated_at
  );
}

export function upsertAgentMessageFromRemote(msg) {
  const database = getDb();
  database.prepare(`
    INSERT OR IGNORE INTO agent_messages (id, chat_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.chat_id, msg.user_id, msg.role, msg.content, msg.created_at);
}

export function upsertHabitCompletionFromRemote(completion) {
  const database = getDb();
  database.prepare(`
    INSERT OR IGNORE INTO habit_completions (id, user_id, habit_id, completed_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(completion.id, completion.user_id, completion.habit_id, completion.completed_date, completion.created_at);
}

// ── Streak helpers ─────────────────────────────────────────────────────────────

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
