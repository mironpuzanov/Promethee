import { supabase } from '../lib/supabase.js';
import { getCurrentUser } from './auth.js';
import { getActiveSession } from './session.js';

let heartbeatInterval = null;
let presenceWindow = null;
let feedPollInterval = null;
let lastPresenceCount = 0;

export function setupPresence(window) {
  presenceWindow = window;

  // Initial fetch
  fetchPresenceCount();
  fetchLiveFeed();

  // Heartbeat: upsert our own presence every 30s while a session is active
  heartbeatInterval = setInterval(async () => {
    await sendHeartbeat();
    await fetchPresenceCount();
  }, 30000);

  // Live feed: poll every 60s
  feedPollInterval = setInterval(() => {
    fetchLiveFeed();
  }, 60000);
}

export function stopPresence() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (feedPollInterval) {
    clearInterval(feedPollInterval);
    feedPollInterval = null;
  }
}

export async function sendHeartbeat(roomId = null) {
  const user = getCurrentUser();
  const activeSession = getActiveSession();

  if (!user) return;

  if (!activeSession) {
    // Remove presence when no session is active
    await removePresence(user.id);
    return;
  }

  try {
    const { error } = await supabase
      .from('presence')
      .upsert({
        user_id: user.id,
        display_name: user.user_metadata?.display_name || user.email,
        room_id: roomId || activeSession.roomId || null,
        task: activeSession.task,
        last_seen: Date.now(),
        session_started_at: activeSession.startedAt
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Presence heartbeat error:', error);
    }
  } catch (err) {
    console.error('sendHeartbeat threw:', err);
  }
}

export async function removePresence(userId) {
  if (!userId) return;
  try {
    await supabase.from('presence').delete().eq('user_id', userId);
  } catch (err) {
    // Ignore — if they're gone, they're gone
  }
}

async function fetchPresenceCount() {
  try {
    // Count users active in the last 90 seconds
    const cutoff = Date.now() - 90_000;
    const { count, error } = await supabase
      .from('presence')
      .select('user_id', { count: 'exact', head: true })
      .gt('last_seen', cutoff);

    if (error) {
      console.error('fetchPresenceCount error:', error);
      return;
    }

    const activeCount = count || 0;
    if (activeCount !== lastPresenceCount) {
      lastPresenceCount = activeCount;
      presenceWindow?.webContents.send('presence:count', activeCount);
    }
  } catch (err) {
    console.error('fetchPresenceCount threw:', err);
  }
}

async function fetchLiveFeed() {
  try {
    // Last 5 session starts within the past 24h
    const cutoff = Date.now() - 86_400_000;
    const { data, error } = await supabase
      .from('live_feed')
      .select('*')
      .gt('started_at', cutoff)
      .order('started_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('fetchLiveFeed error:', error);
      return;
    }

    presenceWindow?.webContents.send('presence:feed', data || []);
  } catch (err) {
    console.error('fetchLiveFeed threw:', err);
  }
}

export async function postToLiveFeed(task, roomId = null) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const { error } = await supabase.from('live_feed').insert({
      user_id: user.id,
      display_name: user.user_metadata?.display_name || user.email,
      task,
      room_id: roomId || null,
      started_at: Date.now()
    });

    if (error) {
      console.error('postToLiveFeed error:', error);
    }

    // Also trigger a fresh feed fetch so the window updates immediately
    await fetchLiveFeed();
  } catch (err) {
    console.error('postToLiveFeed threw:', err);
  }
}

export async function getPresenceCount() {
  const cutoff = Date.now() - 90_000;
  try {
    const { count, error } = await supabase
      .from('presence')
      .select('user_id', { count: 'exact', head: true })
      .gt('last_seen', cutoff);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function getRooms() {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getRooms threw:', err);
    return [];
  }
}

export async function getRoomPresence() {
  const cutoff = Date.now() - 90_000;
  try {
    const { data, error } = await supabase
      .from('presence')
      .select('user_id, display_name, room_id, task')
      .gt('last_seen', cutoff);

    if (error) throw error;

    // Group by room
    const byRoom = {};
    for (const p of data || []) {
      const key = p.room_id || '__none';
      if (!byRoom[key]) byRoom[key] = [];
      byRoom[key].push(p);
    }
    return byRoom;
  } catch (err) {
    console.error('getRoomPresence threw:', err);
    return {};
  }
}
