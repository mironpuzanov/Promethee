import { supabase } from '../lib/supabase.js';
import { BrowserWindow } from 'electron';

let pollInterval = null;

export function setupLeaderboardPolling() {
  // Initial fetch
  fetchLeaderboard();

  // Poll every 30 seconds
  pollInterval = setInterval(() => {
    fetchLeaderboard();
  }, 30000);
}

export function stopLeaderboardPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function fetchLeaderboard() {
  try {
    const { data: topUsers, error: topError } = await supabase
      .from('leaderboard_weekly')
      .select('*')
      .order('weekly_xp', { ascending: false })
      .limit(50);

    if (topError) {
      throw topError;
    }

    // Broadcast to all open windows so both overlay and dashboard stay current
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('leaderboard:update', topUsers || []);
    });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
  }
}

export async function getLeaderboard() {
  try {
    const { data, error } = await supabase
      .from('leaderboard_weekly')
      .select('*')
      .order('weekly_xp', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}
