import { supabase } from '../lib/supabase.js';
import { BrowserWindow } from 'electron';

let pollInterval = null;

async function queryLeaderboard() {
  const rpcResult = await supabase
    .rpc('get_public_leaderboard_weekly', { limit_count: 50 });

  if (!rpcResult.error) {
    return rpcResult.data || [];
  }

  // Dev fallback while the new migration/RPC has not been applied yet.
  if (rpcResult.error.code === 'PGRST202') {
    const legacyResult = await supabase
      .from('leaderboard_weekly')
      .select('*')
      .order('weekly_xp', { ascending: false })
      .limit(50);

    if (!legacyResult.error) {
      console.warn(
        'Leaderboard RPC missing; falling back to legacy leaderboard_weekly view. Apply the latest Supabase migration.'
      );
      return legacyResult.data || [];
    }
  }

  throw rpcResult.error;
}

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
    const topUsers = await queryLeaderboard();

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
    return await queryLeaderboard();
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}
