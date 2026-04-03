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
  `);

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

  // Update level based on XP — threshold: level * 100 XP per level
  // Total XP to reach level N: N*(N-1)/2 * 100
  const profile = getUserProfile(userId);
  if (profile) {
    let newLevel = 1;
    while (true) {
      const xpNeeded = newLevel * (newLevel + 1) / 2 * 100;
      if (xpNeeded > profile.total_xp) break;
      newLevel++;
    }
    const levelStmt = database.prepare(`
      UPDATE user_profile
      SET level = ?
      WHERE id = ?
    `);
    levelStmt.run(newLevel, userId);
  }
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
