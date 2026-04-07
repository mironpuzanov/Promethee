/**
 * Passive window tracker — polls the active app every 30s (idle) or 10s (in session)
 * and logs it to the window_events table.
 *
 * macOS only via active-win. On other platforms it's a no-op.
 */

import { recordWindowEvent } from './db.js';

const POLL_INTERVAL_IDLE = 30_000;   // 30s outside a session
const POLL_INTERVAL_SESSION = 10_000; // 10s during a session — enough for good % breakdown

let pollTimer = null;
let currentUserId = null;
let currentSessionId = null;
let activeWinModule = null; // cached after first import
let loggedActiveWinFailure = false;

async function getActiveWin() {
  if (!activeWinModule) {
    const mod = await import('active-win');
    activeWinModule = mod.default;
  }
  return activeWinModule;
}

async function poll() {
  if (!currentUserId) return;

  try {
    const activeWin = await getActiveWin();
    const win = await activeWin();
    if (!win) return;

    const appName = win.owner?.name || 'Unknown';
    const windowTitle = win.title || null;

    // Always record — time-based sampling gives accurate % breakdowns
    recordWindowEvent(currentUserId, currentSessionId, appName, windowTitle);
  } catch (err) {
    if (!loggedActiveWinFailure) {
      loggedActiveWinFailure = true;
      console.error(
        '[Promethee] active-win failed — app usage will stay empty. On macOS enable Screen Recording for Promethee/Electron.',
        err?.message || err
      );
    }
  }
}

function getInterval() {
  return currentSessionId ? POLL_INTERVAL_SESSION : POLL_INTERVAL_IDLE;
}

function reschedule() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, getInterval());
}

export function startWindowTracking(userId) {
  // Idempotency guard — multiple auth paths call this; only the first call matters
  if (pollTimer && currentUserId === userId) return;
  currentUserId = userId;
  poll(); // immediate first poll
  reschedule();
}

export function stopWindowTracking() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  currentUserId = null;
  currentSessionId = null;
}

export function setTrackingSession(sessionId) {
  currentSessionId = sessionId;
  reschedule(); // switch to faster poll interval
  void poll(); // immediate sample so short sessions and session-complete card get data
}

export function clearTrackingSession() {
  currentSessionId = null;
  reschedule();       // back to slow interval
}

// Live snapshot — call this right before an agent message for always-fresh context
export async function getCurrentApp() {
  try {
    const activeWin = await getActiveWin();
    const win = await activeWin();
    if (!win) return null;
    return { appName: win.owner?.name || 'Unknown', windowTitle: win.title || null };
  } catch {
    return null;
  }
}

/**
 * active-win often returns undefined (not throw) when macOS still blocks metadata.
 * Treat "no owner" as failure so we don't skip the permission UX incorrectly.
 */
export async function probeForegroundApp() {
  try {
    const activeWin = await getActiveWin();
    const win = await activeWin();
    if (!win || !win.owner) {
      return {
        ok: false,
        error:
          'active-win returned no foreground window data (macOS often does this when Screen Recording or Accessibility is missing for this exact Electron.app, or before a full app restart).',
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function canSampleForegroundApp() {
  return (await probeForegroundApp()).ok;
}
