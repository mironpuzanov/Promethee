import {
  createSession,
  endSession as dbEndSession,
  markSessionSynced,
  getUnsyncedSessions,
  updateUserXP
} from './db.js';
import { supabase } from '../lib/supabase.js';

let activeSession = null;

export function startSession(userId, task) {
  if (activeSession) {
    throw new Error('A session is already active');
  }

  activeSession = createSession(userId, task);
  return activeSession;
}

export function getActiveSession() {
  return activeSession;
}

export async function endSessionAndSync() {
  if (!activeSession) {
    throw new Error('No active session to end');
  }

  const endedAt = Date.now();
  const durationSeconds = Math.floor((endedAt - activeSession.startedAt) / 1000);

  // Calculate XP: 10 XP per minute, minimum 60s for any XP
  const xpEarned = durationSeconds < 60 ? 0 : Math.floor(durationSeconds / 60) * 10;

  // Save to local database
  dbEndSession(activeSession.id, xpEarned, durationSeconds);

  // Update user's total XP
  updateUserXP(activeSession.userId, xpEarned);

  const sessionData = {
    ...activeSession,
    endedAt,
    durationSeconds,
    xpEarned
  };

  // Try to sync to Supabase
  try {
    await syncSessionToSupabase(sessionData);
    markSessionSynced(activeSession.id);
  } catch (error) {
    console.error('Failed to sync session to Supabase:', error);
    // Keep synced_at as NULL so it can be retried later
  }

  const completedSession = { ...sessionData };
  activeSession = null;

  return completedSession;
}

async function syncSessionToSupabase(sessionData) {
  const { error } = await supabase.from('sessions').insert({
    id: sessionData.id,
    user_id: sessionData.userId,
    task: sessionData.task,
    started_at: sessionData.startedAt,
    ended_at: sessionData.endedAt || null,
    duration_seconds: sessionData.durationSeconds,
    xp_earned: sessionData.xpEarned,
    source: 'manual',
    app_context: null
  });

  if (error) {
    throw error;
  }
}

export async function flushPendingSyncs() {
  const unsyncedSessions = getUnsyncedSessions();

  for (const session of unsyncedSessions) {
    try {
      await syncSessionToSupabase({
        id: session.id,
        userId: session.user_id,
        task: session.task,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        durationSeconds: session.duration_seconds,
        xpEarned: session.xp_earned
      });
      markSessionSynced(session.id);
      console.log(`Synced session ${session.id}`);
    } catch (error) {
      console.error(`Failed to sync session ${session.id}:`, error);
    }
  }
}

export function pauseSession() {
  if (!activeSession) {
    return null;
  }

  const pausedSession = {
    ...activeSession,
    pausedAt: Date.now()
  };

  return pausedSession;
}

// For testing only - reset active session state
export function resetSessionForTesting() {
  activeSession = null;
}
