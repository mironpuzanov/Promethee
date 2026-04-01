import { supabase } from '../lib/supabase.js';

let mainWindow = null;
let pollInterval = null;

export function setupLeaderboardPolling(window) {
  mainWindow = window;

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
    // Fetch top 50 from leaderboard view
    const { data: topUsers, error: topError } = await supabase
      .from('leaderboard_weekly')
      .select('*')
      .order('weekly_xp', { ascending: false })
      .limit(50);

    if (topError) {
      throw topError;
    }

    // TODO: Fetch current user's rank separately if not in top 50

    if (mainWindow) {
      mainWindow.webContents.send('leaderboard:update', {
        topUsers: topUsers || [],
        userRank: null // Will be implemented when we have user context
      });
    }
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
