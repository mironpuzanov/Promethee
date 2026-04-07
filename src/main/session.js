import {
  createSession,
  endSession as dbEndSession,
  markSessionSynced,
  getUnsyncedSessions,
  updateUserXP,
  updateStreak,
  getUserProfile
} from './db.js';
import { supabase } from '../lib/supabase.js';

let activeSession = null;

export function startSession(userId, task, roomId = null) {
  if (activeSession) {
    throw new Error('A session is already active');
  }

  activeSession = createSession(userId, task);
  if (roomId) activeSession.roomId = roomId;
  return activeSession;
}

export function getActiveSession() {
  return activeSession;
}

// Calculate XP multiplier based on streak and session depth.
// Returns { multiplier, streakBonus, depthBonus }
function calcXpMultiplier(streakDays, durationSeconds) {
  // Streak: +10% per consecutive day, capped at +50% (5 days)
  const streakBonus = Math.min(streakDays * 0.10, 0.50);

  // Depth: +25% for sessions ≥ 2 hours
  const depthBonus = durationSeconds >= 7200 ? 0.25 : 0;

  // Multiplicative, combined cap of 2×
  const multiplier = Math.min((1 + streakBonus) * (1 + depthBonus), 2.0);

  return { multiplier, streakBonus, depthBonus };
}

export async function endSessionAndSync() {
  if (!activeSession) {
    throw new Error('No active session to end');
  }

  const endedAt = Date.now();
  const durationSeconds = Math.floor((endedAt - activeSession.startedAt) / 1000);

  // Update streak first — we need the current streak value for the multiplier
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const currentStreak = updateStreak(activeSession.userId, todayStr);

  // Calculate XP: 10 XP per minute base, minimum 60s for any XP
  const baseXp = durationSeconds < 60 ? 0 : Math.floor(durationSeconds / 60) * 10;
  const { multiplier, streakBonus, depthBonus } = calcXpMultiplier(currentStreak, durationSeconds);
  const xpEarned = Math.round(baseXp * multiplier);

  // Save to local database
  dbEndSession(activeSession.id, xpEarned, durationSeconds);

  // Update user's total XP
  updateUserXP(activeSession.userId, xpEarned);

  const sessionId = activeSession.id;
  const userId = activeSession.userId;

  const sessionData = {
    ...activeSession,
    endedAt,
    durationSeconds,
    xpEarned,
    baseXp,
    multiplier,
    streakBonus,
    depthBonus,
    currentStreak
  };

  const completedSession = { ...sessionData };
  activeSession = null;

  // Never block session end on network — IPC must return fast so the UI can clear.
  void (async () => {
    try {
      await syncSessionToSupabase(sessionData);
      markSessionSynced(sessionId);
      const profile = getUserProfile(userId);
      if (profile) {
        await supabase.from('user_profile').update({
          total_xp: profile.total_xp,
          level: profile.level,
          current_streak: profile.current_streak,
          last_session_date: profile.last_session_date
        }).eq('id', userId);
      }
    } catch (error) {
      console.error('Failed to sync session to Supabase:', error);
    }
  })();

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
    app_context: null,
    room_id: sessionData.roomId || null
  });

  if (error) {
    throw error;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function flushPendingSyncs() {
  const unsyncedSessions = getUnsyncedSessions();

  for (const session of unsyncedSessions) {
    // Skip sessions from the old mock user or non-UUID IDs — they can never sync
    if (!UUID_REGEX.test(session.user_id) || !UUID_REGEX.test(session.id)) {
      markSessionSynced(session.id);
      continue;
    }

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
