import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Debug logging to file
const debugLog = (msg) => {
  const logPath = '/tmp/promethee-debug.log';
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `${timestamp} - ${msg}\n`);
  console.log(msg);
};

debugLog('=== Promethee main process starting ===');

// Set app name immediately — fixes "Electron" showing in dock tooltip and menu bar
app.setName('Promethee');

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import modules
import { startSession, endSessionAndSync, getActiveSession, flushPendingSyncs } from './session.js';
import { signIn, signUp, signOut, sendMagicLink, getUser, setSession, getCurrentUser, updateProfile, updatePassword, uploadAvatar } from './auth.js';
import { setupPowerMonitoring } from './power.js';
import { setupLeaderboardPolling, stopLeaderboardPolling, getLeaderboard } from './leaderboard.js';
import { setupPresence, stopPresence, sendHeartbeat, removePresence, postToLiveFeed, getPresenceCount, getRooms, getRoomPresence } from './presence.js';
import { getTodaysSessions, getSessions, getUserProfile, getCompletedSessionsForSkills, getCompletedSessionsInRange, initializeDatabase, getAgentChats, getOrCreateAgentChat, createAgentChat, getAgentMessages, addAgentMessage, getQuests, createQuest, completeQuest, uncompleteQuest, deleteQuest, resetDailyQuests, setLastDailyJobDate, getLastDailyJobDate, updateStreak, updateUserXP, getWindowEvents, recordWindowEvent, getSessionById, createTask, getTasksBySession, getTasksByUser, toggleTask, deleteTask, createNote, getNotesBySession, getNotesByUser, deleteNote, getMemorySnapshotCache, getMemorySnapshotCacheByDate, upsertMemorySnapshotCache, listHabitCache, getHabitCacheById, upsertHabitCache, markHabitCacheDeleted, removeHabitCache, setHabitCacheSyncState, getPendingHabitCache } from './db.js';
import { startWindowTracking, stopWindowTracking, setTrackingSession, clearTrackingSession, getCurrentApp, canSampleForegroundApp } from './windowTracker.js';
import { maybePromptScreenRecordingAccess, resetScreenRecordingPromptGate } from './screenRecordingPrompt.js';
import { shouldIncludeAppInUsageStats } from '../lib/appUsageFilter.js';
import keytar from 'keytar';
import {
  setFocusShortcutBroadcast,
  loadFocusShortcuts,
  saveFocusShortcutsToDisk,
  validateFocusShortcutsConfig,
  applyRegisteredFocusShortcuts,
  unregisterAllFocusShortcuts,
} from './focusShortcuts.js';
import {
  setUpdateBroadcast,
  getUpdateState,
  checkForAppUpdate,
  openUpdateDownload,
  skipUpdateVersion,
  clearSkippedUpdateVersion,
} from './updateCheck.js';

function scheduleDailyJobs(userId) {
  if (!userId) return;
  runDailyJobs(userId).catch((e) => debugLog(`runDailyJobs error: ${e.message}`));
}

function startTrackingWithPermissionPrompt(userId) {
  startWindowTracking(userId);
  if (process.platform === 'darwin') {
    console.log('[Promethee] Scheduling active-win / Screen Recording check (next microtask)…');
  }
  setImmediate(() => {
    const parent =
      fullWindow && !fullWindow.isDestroyed()
        ? fullWindow
        : floatingWindow && !floatingWindow.isDestroyed()
          ? floatingWindow
          : BrowserWindow.getFocusedWindow();
    maybePromptScreenRecordingAccess(parent ?? undefined).catch((e) => {
      console.error('[Promethee] screenRecording prompt failed:', e);
      debugLog(`screenRecording prompt: ${e.message}`);
    });
  });
}
import OpenAI from 'openai';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// Commented out for now as it's causing issues with ES modules
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

let floatingWindow = null;
let fullWindow = null;
let tray = null;
let dailyJobsInterval = null;
let updateCheckInterval = null;

/** Mentor “attach screen”: store PNG data URL in main so we don’t ship multi‑MB strings renderer→main (IPC clone limits / perf). */
let pendingAgentScreenDataUrl = null;

const createFloatingWindow = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  floatingWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    show: false, // don't flash — shown explicitly after auth check
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    visibleOnAllWorkspaces: true,
    hasShadow: false,
    focusable: false,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?mode=floating`);
  } else {
    floatingWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      query: { mode: 'floating' }
    });
  }

  // Open DevTools in development
  // floatingWindow.webContents.openDevTools({ mode: 'detach' });

  floatingWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    debugLog(`Window failed to load: ${errorCode} ${errorDescription}`);
    // Keep retrying until Vite is ready
    if (errorCode === -102 && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      setTimeout(() => {
        floatingWindow?.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?mode=floating`);
      }, 1500);
    }
  });

  // Allow clicks to pass through transparent areas — only overlay elements receive events
  floatingWindow.setIgnoreMouseEvents(true, { forward: true });

  // Must be called after creation to actually stick on all spaces + fullscreen apps
  // Use 'floating' level — 'screen-saver' can prevent the window from following across spaces on macOS
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.setAlwaysOnTop(true, 'floating', 1);

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
};

const createFullWindow = ({ sessionComplete = false } = {}) => {
  const w = sessionComplete ? 380 : 1200;
  const h = sessionComplete ? 620 : 900;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  fullWindow = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    show: false, // show after load to avoid flash
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    transparent: false,
    backgroundColor: '#0a0a0a',
    hasShadow: true,
    movable: true,
    skipTaskbar: false,
    title: 'Promethee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    fullWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?mode=full`);
  } else {
    fullWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      query: { mode: 'full' }
    });
  }

  // Show once the page is ready — avoids blank flash
  fullWindow.webContents.once('did-finish-load', () => {
    fullWindow?.show();
    fullWindow?.focus();
    // Ensure dock icon is visible (panel-type floating window can suppress it)
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
  });

  // Hide overlay while dashboard is open, restore it when dashboard closes
  floatingWindow?.hide();

  fullWindow.on('closed', () => {
    fullWindow = null;
    floatingWindow?.show();
  });
};

const createTray = () => {
  // __dirname = .vite/build/ in dev — resolve up to project root
  const trayIconPath = path.resolve(__dirname, '../../src/assets/tray-icon.png');
  const trayIcon2xPath = path.resolve(__dirname, '../../src/assets/tray-icon@2x.png');
  let icon;
  if (fs.existsSync(trayIconPath)) {
    icon = nativeImage.createEmpty();
    icon.addRepresentation({ scaleFactor: 1.0, dataURL: nativeImage.createFromPath(trayIconPath).toDataURL() });
    if (fs.existsSync(trayIcon2xPath)) {
      icon.addRepresentation({ scaleFactor: 2.0, dataURL: nativeImage.createFromPath(trayIcon2xPath).toDataURL() });
    }
    icon.setTemplateImage(true);
  } else {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Overlay',
      click: () => {
        if (fullWindow) fullWindow.close();
        floatingWindow?.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('Promethee');
  tray.setContextMenu(contextMenu);

  // Click = just open the context menu, nothing else
  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  tray.on('double-click', () => {
    if (!fullWindow) {
      createFullWindow();
    } else {
      fullWindow.show();
    }
  });
};

// Catch any uncaught exceptions
process.on('uncaughtException', (error) => {
  debugLog(`UNCAUGHT EXCEPTION: ${error.message}`);
  debugLog(error.stack);
  console.error('Uncaught exception:', error);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`UNHANDLED REJECTION: ${reason}`);
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Register promethee:// deep link protocol (must be before app.whenReady)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('promethee', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('promethee');
}

// Handle deep link on macOS (app already open)
app.on('open-url', async (event, url) => {
  event.preventDefault();
  await handleDeepLink(url);
});

async function handleDeepLink(url) {
  debugLog(`Deep link received: ${url}`);
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'auth' && parsed.pathname === '/callback') {
      // Supabase returns tokens in the hash fragment (#access_token=...), not query params
      const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
      const params = new URLSearchParams(hash);

      const error = params.get('error');
      if (error) {
        debugLog(`Auth callback error: ${error} — ${params.get('error_description')}`);
        // Notify the login window to show an error
        fullWindow?.webContents.send('auth:error', params.get('error_description'));
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const user = await setSession(accessToken, refreshToken);
        if (user) {
          if (user.id) startTrackingWithPermissionPrompt(user.id);
          debugLog(`Auth callback: signed in as ${user.email}`);
          // Close login/onboarding window
          if (fullWindow) {
            fullWindow.close();
          }
          // Tell floating overlay the user is now authenticated
          floatingWindow?.webContents.send('auth:success', user);
          // Show overlay and pre-focus task input so user can start their first session immediately
          floatingWindow?.show();
          setTimeout(() => {
            floatingWindow?.webContents.send('focus:taskInput', { roomId: null });
          }, 200);
          // Run daily jobs for the newly authenticated user
          runDailyJobs(user.id).catch(e => debugLog(`runDailyJobs error: ${e.message}`));
        }
      }
    }
  } catch (err) {
    debugLog(`Deep link error: ${err.message}`);
  }
}

// Stay as regular app from the start so the dock icon is always visible.
// accessory→regular transition in dev causes the dock icon to disappear.
if (process.platform === 'darwin') {
  app.setActivationPolicy('regular');
}

debugLog('Setting up app.whenReady handler');

// App lifecycle
app.whenReady().then(async () => {
  debugLog('=== App is ready, starting initialization ===');

  // Set dock icon — __dirname is .vite/build/ in dev, so go up to project root
  if (process.platform === 'darwin') {
    try {
      const iconPath = path.resolve(__dirname, '../../src/assets/icon.png');
      if (app.dock && fs.existsSync(iconPath)) {
        app.dock.setIcon(nativeImage.createFromPath(iconPath));
      }
    } catch (e) {}
  }

  try {
    initializeDatabase();
    createTray();
  } catch (error) {
    debugLog(`!!! Error during initialization: ${error.message}`);
    debugLog(error.stack);
    throw error;
  }

  // Auth check first — create windows based on result
  try {
    debugLog('Attempting to restore user session...');
    const user = await getUser();
    debugLog(`Session restore result: ${user ? `found user ${user.email}` : 'no session'}`);

    // Always create floating window now (needed regardless of auth state)
    createFloatingWindow();

    if (!user) {
      // No session — show login, floating stays hidden until dashboard closes
      createFullWindow();
    } else {
      // Session restored — go straight to dashboard, floating hidden
      createFullWindow();
      await flushPendingSyncs();
      startTrackingWithPermissionPrompt(user.id);
      // Run once-per-day jobs (quest resets, etc.)
      scheduleDailyJobs(user.id);
    }
  } catch (error) {
    debugLog(`Failed to restore user session: ${error.message}`);
    createFloatingWindow();
    createFullWindow();
  }

  setFocusShortcutBroadcast((action) => {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    try {
      floatingWindow.webContents.send('focusShortcut', action);
    } catch {
      /* ignore */
    }
  });
  setUpdateBroadcast((state) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.isDestroyed()) return;
      try {
        window.webContents.send('update:status', state);
      } catch {
        /* ignore */
      }
    });
  });
  applyRegisteredFocusShortcuts();

  setupPowerMonitoring(floatingWindow);
  setupLeaderboardPolling();
  setupPresence(floatingWindow);
  dailyJobsInterval = setInterval(() => {
    const user = getCurrentUser();
    if (user?.id) scheduleDailyJobs(user.id);
  }, 5 * 60 * 1000);
  setTimeout(() => {
    checkForAppUpdate().catch((e) => {
      debugLog(`checkForAppUpdate error: ${e.message}`);
    });
  }, 2500);
  updateCheckInterval = setInterval(() => {
    checkForAppUpdate().catch((e) => {
      debugLog(`scheduled update check error: ${e.message}`);
    });
  }, 12 * 60 * 60 * 1000);

  app.on('activate', () => {
    // Dock click — bring full window to front if it exists, otherwise open it
    if (fullWindow) {
      fullWindow.show();
      fullWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createFloatingWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  stopLeaderboardPolling();
  stopPresence();
  unregisterAllFocusShortcuts();
  if (dailyJobsInterval) {
    clearInterval(dailyJobsInterval);
    dailyJobsInterval = null;
  }
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  const user = getCurrentUser();
  if (user) await removePresence(user.id);
});

ipcMain.handle('update:getState', () => getUpdateState());

ipcMain.handle('update:check', async (_event, force = false) => checkForAppUpdate({ force: Boolean(force) }));

ipcMain.handle('update:openDownload', async () => {
  try {
    return await openUpdateDownload();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not open download page' };
  }
});

ipcMain.handle('update:skipVersion', (_event, version = null) => skipUpdateVersion(version));

ipcMain.handle('update:clearSkippedVersion', () => clearSkippedUpdateVersion());

ipcMain.handle('shortcuts:get', () => {
  try {
    return { success: true, shortcuts: loadFocusShortcuts() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('shortcuts:set', (_event, partial) => {
  try {
    if (!partial || typeof partial !== 'object') {
      return { success: false, error: 'Invalid payload.' };
    }
    const cur = loadFocusShortcuts();
    const next = { ...cur };
    for (const k of ['focusOpenMentor', 'focusAddTask', 'focusEndSession']) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        next[k] = partial[k] === '' || partial[k] == null ? '' : String(partial[k]).trim();
      }
    }
    const v = validateFocusShortcutsConfig(next);
    if (!v.ok) return { success: false, error: v.error };
    saveFocusShortcutsToDisk({
      focusOpenMentor: next.focusOpenMentor,
      focusAddTask: next.focusAddTask,
      focusEndSession: next.focusEndSession,
    });
    applyRegisteredFocusShortcuts();
    return { success: true, shortcuts: loadFocusShortcuts() };
  } catch (e) {
    return { success: false, error: e.message || 'Failed to save shortcuts.' };
  }
});

// Mouse passthrough for floating overlay
ipcMain.on('set-ignore-mouse-events-true', () => {
  floatingWindow?.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('set-ignore-mouse-events-false', () => {
  floatingWindow?.setIgnoreMouseEvents(false);
});

ipcMain.on('set-focusable-true', () => {
  floatingWindow?.setFocusable(true);
  floatingWindow?.focus();
});

ipcMain.on('set-focusable-false', () => {
  floatingWindow?.setFocusable(false);
});

// IPC Handlers
ipcMain.handle('session:start', async (event, task, roomId = null) => {
  try {
    // Use in-memory user — avoids an async Supabase round-trip on every session start
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const session = startSession(user.id, task, roomId);
    setTrackingSession(session.id);

    setImmediate(() => {
      void (async () => {
        if (process.platform !== 'darwin') return;
        if (await canSampleForegroundApp()) return;
        resetScreenRecordingPromptGate();
        const parent =
          fullWindow && !fullWindow.isDestroyed()
            ? fullWindow
            : floatingWindow && !floatingWindow.isDestroyed()
              ? floatingWindow
              : BrowserWindow.getFocusedWindow();
        await maybePromptScreenRecordingAccess(parent ?? undefined);
      })().catch((e) => debugLog(`session:start screen prompt: ${e.message}`));
    });

    // Presence is best-effort. Never block local session start on network health.
    void postToLiveFeed(task, roomId);
    void sendHeartbeat(roomId);

    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session:end', async () => {
  try {
    const user = getCurrentUser();
    const session = await endSessionAndSync();
    clearTrackingSession();

    // Fire-and-forget: never stall session:end on network or active-win
    if (user?.id && session?.id) {
      void (async () => {
        try {
          const live = await getCurrentApp();
          if (live) recordWindowEvent(user.id, session.id, live.appName, live.windowTitle);
        } catch (e) {
          debugLog(`session:end final window sample: ${e?.message || e}`);
        }
      })();
    }
    if (user) void removePresence(user.id).catch(() => {});

    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function refreshHabitCacheFromSupabase(userId) {
  const { supabase } = await import('../lib/supabase.js');
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  for (const habit of data || []) {
    upsertHabitCache(userId, habit, 'synced');
  }
  return listHabitCache(userId);
}

async function syncPendingHabits(userId) {
  const pending = getPendingHabitCache(userId);
  if (pending.length === 0) return;
  const { supabase } = await import('../lib/supabase.js');

  for (const habit of pending) {
    if (habit.sync_state === 'pending_delete') {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habit.id)
        .eq('user_id', userId);
      if (error) throw error;
      removeHabitCache(userId, habit.id);
      continue;
    }

    const payload = {
      id: habit.id,
      user_id: userId,
      title: habit.title,
      frequency: habit.frequency || 'daily',
      last_completed_date: habit.last_completed_date ?? null,
      current_streak: habit.current_streak || 0,
      created_at: habit.created_at,
    };

    const { data, error } = await supabase
      .from('habits')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    upsertHabitCache(userId, data || payload, 'synced');
  }
}

ipcMain.handle('session:getToday', async () => {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const sessions = getTodaysSessions(user.id);
    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session:getActive', async () => {
  try {
    const session = getActiveSession();
    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:signIn', async (event, email, password) => {
  try {
    const result = await signIn(email, password);
    if (result.user) {
      // Password sign-in succeeded — open dashboard immediately, no deep link needed
      if (fullWindow) fullWindow.close();
      floatingWindow?.webContents.send('auth:success', result.user);
      createFullWindow();
      floatingWindow?.hide();
      startTrackingWithPermissionPrompt(result.user.id);
      scheduleDailyJobs(result.user.id);
    }
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:sendMagicLink', async (event, email) => {
  try {
    const result = await sendMagicLink(email);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:signUp', async (event, email, password) => {
  try {
    const result = await signUp(email, password);
    if (result.session) {
      // Auto-confirmed — set session and open dashboard
      const user = await setSession(result.session.access_token, result.session.refresh_token);
      if (user) {
        if (user.id) startTrackingWithPermissionPrompt(user.id);
        if (fullWindow) fullWindow.close();
        createFullWindow();
        floatingWindow?.hide();
        scheduleDailyJobs(user.id);
      }
    }
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:setSession', async (event, accessToken, refreshToken) => {
  try {
    const user = await setSession(accessToken, refreshToken);
    if (user?.id) {
      startTrackingWithPermissionPrompt(user.id);
      scheduleDailyJobs(user.id);
    }
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:signOut', async () => {
  try {
    stopWindowTracking();
    const result = await signOut();
    // Close dashboard, open login screen, hide overlay
    if (fullWindow) fullWindow.close();
    floatingWindow?.hide();
    floatingWindow?.webContents.send('auth:signed-out');
    createFullWindow();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:getUser', async () => {
  try {
    const user = await getUser();
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:updateProfile', async (event, updates) => {
  try {
    const result = await updateProfile(updates);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:updatePassword', async (event, newPassword) => {
  try {
    const result = await updatePassword(newPassword);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:uploadAvatar', async (event, fileBuffer, mimeType) => {
  try {
    const buffer = Buffer.from(fileBuffer);
    const result = await uploadAvatar(buffer, mimeType);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('leaderboard:get', async () => {
  try {
    const leaderboard = await getLeaderboard();
    return { success: true, leaderboard };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('presence:getCount', async () => {
  try {
    const count = await getPresenceCount();
    return { success: true, count };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('presence:getRooms', async () => {
  try {
    const rooms = await getRooms();
    const roomPresence = await getRoomPresence();
    return { success: true, rooms, roomPresence };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:getEvents', async (_event, opts = {}) => {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const events = getWindowEvents(user.id, opts);
    return { success: true, events };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getSessions', async () => {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const sessions = getSessions(user.id);
    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getUserProfile', async () => {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const profile = getUserProfile(user.id);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:startFocusFromDashboard', async (event, roomId) => {
  // Close dashboard, show overlay, tell overlay to open task input
  if (fullWindow) {
    fullWindow.close();
  }
  floatingWindow?.show();
  // Small delay for window transition, then focus the input
  setTimeout(() => {
    floatingWindow?.webContents.send('focus:taskInput', { roomId: roomId || null });
  }, 120);
  return { success: true };
});

let pendingSessionComplete = null;

ipcMain.handle('window:getPendingSessionComplete', () => {
  const data = pendingSessionComplete;
  pendingSessionComplete = null;
  return data;
});

ipcMain.handle('window:openSessionComplete', async (event, sessionData) => {
  floatingWindow?.hide();
  pendingSessionComplete = sessionData;
  if (!fullWindow) {
    // Create window already at portrait size — no resize needed after
    createFullWindow({ sessionComplete: true });
  } else {
    // Window already open — resize instantly before showing the screen
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    fullWindow.setResizable(true);
    fullWindow.setBounds({
      x: Math.round((width - 380) / 2),
      y: Math.round((height - 620) / 2),
      width: 380,
      height: 620,
    });
    fullWindow.setResizable(false);
    fullWindow.show();
    fullWindow.webContents.send('window:sessionComplete', sessionData);
    pendingSessionComplete = null;
  }
  return { success: true };
});

ipcMain.handle('window:resizeForSessionComplete', () => {
  if (fullWindow) {
    fullWindow.setResizable(true);
    fullWindow.setSize(380, 620, true);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    fullWindow.setPosition(
      Math.round((width - 380) / 2),
      Math.round((height - 620) / 2),
      true
    );
    fullWindow.setResizable(false);
  }
});

ipcMain.handle('window:restoreFromSessionComplete', () => {
  if (fullWindow) {
    fullWindow.setResizable(true);
    fullWindow.setSize(1200, 900, true);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    fullWindow.setPosition(
      Math.round((width - 1200) / 2),
      Math.round((height - 900) / 2),
      true
    );
    fullWindow.setResizable(true);
  }
});

// Capture the user's full screen as a base64 PNG for agent vision context
ipcMain.handle('window:captureScreen', async () => {
  const windowsToRestore = [];
  try {
    await getUser();
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Sign in required.' };

    const hideIfShowing = (w) => {
      if (w && !w.isDestroyed() && w.isVisible()) {
        w.hide();
        windowsToRestore.push(w);
      }
    };
    const dashboardVisible = fullWindow && !fullWindow.isDestroyed() && fullWindow.isVisible();

    // Hide dashboard window if it’s only partially in play; focus overlay stays visible so the HUD
    // doesn’t flash and the capture matches what the user sees (timer + pills + desktop).
    if (!dashboardVisible) {
      hideIfShowing(fullWindow);
    }
    // Full-window Mentor/dashboard: hide floating overlay so the shot isn’t duplicated UI.
    if (dashboardVisible) {
      hideIfShowing(floatingWindow);
    }

    if (windowsToRestore.length > 0) {
      await new Promise((r) => setTimeout(r, 160));
    }

    const { desktopCapturer } = await import('electron');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (!sources.length) {
      const hint =
        process.platform === 'darwin'
          ? 'No screen source (often Screen Recording is off). System Settings → Privacy & Security → Screen Recording → enable Promethee or Electron (dev), then fully quit (⌘Q) and reopen.'
          : 'No screen sources returned by the OS.';
      debugLog(`captureScreen: ${hint}`);
      return { success: false, error: hint };
    }

    let bestPng = null;
    let bestBytes = 0;
    for (const s of sources) {
      try {
        const t = s.thumbnail;
        if (!t || t.isEmpty()) continue;
        const png = t.toPNG();
        if (png && png.length > bestBytes) {
          bestBytes = png.length;
          bestPng = png;
        }
      } catch (e) {
        debugLog(`captureScreen: skip source: ${e.message}`);
      }
    }

    if (!bestPng || bestBytes < 2048) {
      const hint =
        process.platform === 'darwin'
          ? 'Snapshot was empty or too small. Grant Screen Recording for Electron (npm start) or Promethee, then fully quit (⌘Q) and reopen.'
          : 'Screen thumbnail was empty.';
      debugLog(`captureScreen: ${hint} (bestBytes=${bestBytes}, sources=${sources.length})`);
      return { success: false, error: hint };
    }

    const dataUrl = `data:image/png;base64,${bestPng.toString('base64')}`;
    pendingAgentScreenDataUrl = dataUrl;
    debugLog(`captureScreen: ok, ${bestBytes} bytes PNG, hidAppFrames=${windowsToRestore.length}`);
    return { success: true };
  } catch (error) {
    debugLog(`captureScreen error: ${error.message}`);
    return { success: false, error: error.message || 'Capture failed' };
  } finally {
    for (const w of windowsToRestore) {
      try {
        if (!w.isDestroyed()) w.show();
      } catch (e) {
        debugLog(`captureScreen restore window: ${e.message}`);
      }
    }
  }
});

ipcMain.handle('window:clearPendingScreenCapture', () => {
  pendingAgentScreenDataUrl = null;
  return { success: true };
});

ipcMain.handle('window:captureSessionCard', async () => {
  if (!fullWindow) return { success: false, error: 'No window' };
  try {
    const [w, h] = fullWindow.getSize();
    const image = await fullWindow.webContents.capturePage({
      x: 0, y: 0, width: w, height: h - 80,
    });
    // Save to Downloads so the user can easily find it
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, `promethee-session-${Date.now()}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    // Reveal in Finder
    const { shell } = await import('electron');
    shell.showItemInFolder(filePath);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:copyImageToClipboard', async () => {
  if (!fullWindow) return { success: false };
  try {
    const [w, h] = fullWindow.getSize();
    const image = await fullWindow.webContents.capturePage({
      x: 0, y: 0, width: w, height: h - 80,
    });
    const { clipboard } = await import('electron');
    clipboard.writeImage(image);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:copyImageAndText', async (_event, text) => {
  if (!fullWindow) return { success: false };
  try {
    const [w, h] = fullWindow.getSize();
    const image = await fullWindow.webContents.capturePage({
      x: 0, y: 0, width: w, height: h - 80,
    });
    const { clipboard, nativeImage } = await import('electron');
    // Write both image and text to clipboard simultaneously
    clipboard.write({
      image: nativeImage.createFromBuffer(image.toPNG()),
      text,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:openExternal', async (_event, url) => {
  let parsed;
  try { parsed = new URL(url); } catch { return { success: false, error: 'Invalid URL' }; }
  const allowed = ['https:', 'http:', 'discord:'];
  if (!allowed.includes(parsed.protocol)) {
    debugLog(`openExternal blocked unsafe protocol: ${parsed.protocol}`);
    return { success: false, error: 'Blocked: unsafe URL scheme' };
  }
  const { shell } = await import('electron');
  await shell.openExternal(url);
  return { success: true };
});

ipcMain.handle('window:copyText', async (_event, text) => {
  const { clipboard } = await import('electron');
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('window:close', () => {
  // Use direct ref — getFocusedWindow() returns null if focus was lost momentarily
  if (fullWindow) fullWindow.close();
});

ipcMain.handle('window:minimize', () => {
  if (fullWindow) fullWindow.minimize();
});

ipcMain.handle('window:toggleFullWindow', () => {
  if (!fullWindow) {
    createFullWindow(); // createFullWindow already hides overlay
  } else if (fullWindow.isVisible()) {
    fullWindow.hide();
    floatingWindow?.show();
  } else {
    fullWindow.show();
    floatingWindow?.hide();
  }
});

// Agent IPC Handlers

const AGENT_KEYCHAIN_SERVICE = 'Promethee';
const AGENT_KEYCHAIN_ACCOUNT = 'openai-key';

ipcMain.handle('agent:getToken', async () => {
  try {
    const key = await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT);
    if (!key) {
      return { success: false, error: 'No API key configured. Set it via agent:setToken.' };
    }
    return { success: true, token: key };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:setToken', async (_event, key) => {
  try {
    await keytar.setPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT, key);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Sanitize OS-provided strings before embedding in LLM prompts.
// Window titles are user-controlled (e.g. browser tab names) and can contain
// adversarial prompt-injection text — truncate and strip newlines/control chars.
function sanitizeForPrompt(str, maxLen = 120) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLen);
}

async function buildWindowContext(user, activeSession) {
  let ctx = '';
  const liveApp = await getCurrentApp();
  if (liveApp) {
    const appName = sanitizeForPrompt(liveApp.appName, 60);
    const title = liveApp.windowTitle ? ` ("${sanitizeForPrompt(liveApp.windowTitle)}")` : '';
    ctx = `\nActive app right now: ${appName}${title}.`;
  }
  if (user) {
    const sinceMs = activeSession ? activeSession.startedAt : Date.now() - 3600_000;
    const events = getWindowEvents(user.id, { sinceMs, sessionId: activeSession?.id, limit: 200 });
    if (events.length > 0) {
      const appCounts = {};
      for (const e of events) {
        if (!shouldIncludeAppInUsageStats(e.app_name)) continue;
        appCounts[e.app_name] = (appCounts[e.app_name] || 0) + 1;
      }
      const topApps = Object.entries(appCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name]) => sanitizeForPrompt(name, 40))
        .join(', ');
      if (topApps) ctx += `\nApps this session: ${topApps}.`;
    }
  }
  return ctx;
}

ipcMain.handle('agent:getChats', async () => {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const chats = getAgentChats(user.id);
    return { success: true, chats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:getOrCreateChat', async (_event, title, sessionId, systemPrompt) => {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const chat = getOrCreateAgentChat(user.id, title, sessionId, systemPrompt);
    return { success: true, chat };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:createChat', async (_event, title, sessionId, systemPrompt) => {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const chat = createAgentChat(user.id, title, sessionId, systemPrompt);
    return { success: true, chat };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:getMessages', async (_event, chatId) => {
  try {
    const messages = getAgentMessages(chatId);
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:sendMessage', async (_event, chatId, content, previousMessages) => {
  try {
    const keyResult = await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT);
    if (!keyResult) {
      return { success: false, error: 'No API key. Configure it first.' };
    }

    // Persist user message
    addAgentMessage(chatId, 'user', content);

    const openai = new OpenAI({ apiKey: keyResult });

    // Build system prompt fresh from DB so the agent always has current stats
    const user = await getUser();
    const activeSession = getActiveSession();
    const todaysSessions = user ? getTodaysSessions(user.id) : [];
    const profile = user ? getUserProfile(user.id) : null;

    const xpToday = todaysSessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
    const sessionCountToday = todaysSessions.length;
    const recentNames = todaysSessions.slice(0, 5).map(s => {
      const mins = s.duration_seconds ? Math.round(s.duration_seconds / 60) : '?';
      return `"${s.task || 'Untitled'}" — ${mins}m`;
    }).join(', ');

    const level = profile?.level || 1;
    const totalXp = profile?.total_xp || 0;

    const windowContext = await buildWindowContext(user, activeSession);

    let resolvedSystemPrompt;
    if (activeSession) {
      const elapsedMinutes = Math.floor((Date.now() - activeSession.startedAt) / 60000);
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${activeSession.task || 'Untitled'}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.${windowContext}
Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
    } else {
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck.

Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.${windowContext}
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely.`;
    }

    const messagesForApi = [
      { role: 'system', content: resolvedSystemPrompt },
      ...previousMessages
        .filter(m => m.content != null && m.content !== '')
        .map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content }
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messagesForApi,
      stream: true
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:chunk', { chatId, delta }));
      }
    }

    // Persist assistant message
    const saved = addAgentMessage(chatId, 'assistant', fullContent);
    [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:streamEnd', { chatId, message: saved }));

    return { success: true };
  } catch (error) {
    [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:streamError', { chatId, error: error.message }));
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent:sendMessageWithImages', async (_event, chatId, content, images, previousMessages) => {
  try {
    const keyResult = await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT);
    if (!keyResult) {
      return { success: false, error: 'No API key. Configure it first.' };
    }

    const fromRenderer = Array.isArray(images)
      ? images.filter((x) => typeof x === 'string' && x.length > 0)
      : [];
    const visionUrls = [];
    if (fromRenderer.length > 0) {
      visionUrls.push(...fromRenderer);
    }
    if (pendingAgentScreenDataUrl) {
      visionUrls.push(pendingAgentScreenDataUrl);
      pendingAgentScreenDataUrl = null;
    }

    debugLog(
      `sendMessageWithImages: chatId=${chatId} visionParts=${visionUrls.length} fromRenderer=${fromRenderer.length}`
    );

    // Persist only text content to SQLite (images are ephemeral)
    addAgentMessage(chatId, 'user', content);

    const openai = new OpenAI({ apiKey: keyResult });

    const user = await getUser();
    const activeSession = getActiveSession();
    const todaysSessions = user ? getTodaysSessions(user.id) : [];
    const profile = user ? getUserProfile(user.id) : null;

    const xpToday = todaysSessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
    const sessionCountToday = todaysSessions.length;
    const recentNames = todaysSessions.slice(0, 5).map(s => {
      const mins = s.duration_seconds ? Math.round(s.duration_seconds / 60) : '?';
      return `"${s.task || 'Untitled'}" — ${mins}m`;
    }).join(', ');

    const level = profile?.level || 1;
    const totalXp = profile?.total_xp || 0;

    const windowContext = await buildWindowContext(user, activeSession);

    let resolvedSystemPrompt;
    if (activeSession) {
      const elapsedMinutes = Math.floor((Date.now() - activeSession.startedAt) / 60000);
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${activeSession.task || 'Untitled'}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.${windowContext}
Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
    } else {
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck.

Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.${windowContext}
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely.`;
    }

    if (visionUrls.length > 0) {
      resolvedSystemPrompt +=
        "\n\nYou can see the user's screen right now (their workspace — Promethee is hidden from the frame briefly so you mostly see their other work). Use what you see to help." +
        "\n\nIn your replies: never tell the user you got a screenshot, photo, image, picture, or file, or that they attached something visual — answer as if you're looking at their screen with them, naturally.";
    }

    // Build the final user message with text + image content blocks
    const userContent = [
      { type: 'text', text: content },
      ...visionUrls.map((dataUrl) => ({
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'auto' },
      })),
    ];

    const messagesForApi = [
      { role: 'system', content: resolvedSystemPrompt },
      ...previousMessages
        .filter(m => m.content != null && m.content !== '')
        .map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: userContent }
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messagesForApi,
      stream: true
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:chunk', { chatId, delta }));
      }
    }

    const saved = addAgentMessage(chatId, 'assistant', fullContent);
    [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:streamEnd', { chatId, message: saved }));

    return { success: true };
  } catch (error) {
    [floatingWindow, fullWindow].forEach(w => w?.webContents.send('agent:streamError', { chatId, error: error.message }));
    return { success: false, error: error.message };
  }
});

// ── Skills IPC Handler ────────────────────────────────────────────────────────
// Scores 0–100 from local SQLite (same source as Session log). Last 30 days only.
// rigueur  = total focus minutes / 3000 min cap
// volonte  = current_streak days / 30 day cap (local user_profile)
// courage  = sessions ≥ 2h / 20 sessions cap

ipcMain.handle('skills:get', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sessions = getCompletedSessionsForSkills(user.id, thirtyDaysAgo);
    const profileRow = getUserProfile(user.id);
    const streak = profileRow?.current_streak || 0;

    const totalMinutes = sessions.reduce((sum, s) => {
      return sum + Math.floor((s.duration_seconds || 0) / 60);
    }, 0);
    const rigueur = Math.min(Math.round((totalMinutes / 3000) * 100), 100);

    const volonte = Math.min(Math.round((streak / 30) * 100), 100);

    const deepSessions = sessions.filter(s => (s.duration_seconds || 0) >= 7200).length;
    const courage = Math.min(Math.round((deepSessions / 20) * 100), 100);
    const sessionCount = sessions.length;

    return {
      success: true,
      skills: { rigueur, volonte, courage },
      raw: { totalMinutes, streak, deepSessions, sessionCount }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Habits IPC Handlers ───────────────────────────────────────────────────────
// Habits are local-first in SQLite, with best-effort Supabase sync.

ipcMain.handle('habits:list', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const cached = listHabitCache(user.id);

    try {
      await syncPendingHabits(user.id);
      const habits = await refreshHabitCacheFromSupabase(user.id);
      return { success: true, habits };
    } catch (error) {
      debugLog(`habits:list offline fallback: ${error.message}`);
      return { success: true, habits: cached };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:create', async (_event, title, frequency) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const trimmed = String(title || '').trim();
    if (!trimmed) return { success: false, error: 'Title is required' };

    const localHabit = upsertHabitCache(user.id, {
      id: crypto.randomUUID(),
      title: trimmed,
      frequency: frequency || 'daily',
      last_completed_date: null,
      current_streak: 0,
      created_at: Date.now(),
    }, 'pending_upsert');

    void syncPendingHabits(user.id).catch((e) => debugLog(`habits:create sync failed: ${e.message}`));
    return { success: true, habit: localHabit };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:complete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const habit = getHabitCacheById(user.id, habitId);
    if (!habit) return { success: false, error: 'Habit not found' };

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    // Already completed today
    if (habit.last_completed_date === todayStr) {
      return { success: true, habit };
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    const newStreak = habit.last_completed_date === yesterdayStr
      ? (habit.current_streak || 0) + 1
      : 1;

    const updated = upsertHabitCache(user.id, {
      ...habit,
      last_completed_date: todayStr,
      current_streak: newStreak,
      updated_at: Date.now(),
    }, 'pending_upsert');

    void syncPendingHabits(user.id).catch((e) => debugLog(`habits:complete sync failed: ${e.message}`));
    return { success: true, habit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:uncomplete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const todayStr = new Date().toLocaleDateString('en-CA');
    const habit = getHabitCacheById(user.id, habitId);

    // Only allow uncompleting if completed today
    if (!habit || habit.last_completed_date !== todayStr) {
      return { success: false, error: 'Not completed today' };
    }

    const newStreak = Math.max(0, (habit.current_streak || 1) - 1);
    const updated = upsertHabitCache(user.id, {
      ...habit,
      last_completed_date: null,
      current_streak: newStreak,
      updated_at: Date.now(),
    }, 'pending_upsert');

    void syncPendingHabits(user.id).catch((e) => debugLog(`habits:uncomplete sync failed: ${e.message}`));
    return { success: true, habit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:delete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const habit = getHabitCacheById(user.id, habitId);
    if (!habit) return { success: false, error: 'Habit not found' };
    markHabitCacheDeleted(user.id, habitId);
    void syncPendingHabits(user.id).catch((e) => debugLog(`habits:delete sync failed: ${e.message}`));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Quest IPC Handlers ────────────────────────────────────────────────────────

ipcMain.handle('quests:list', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const quests = getQuests(user.id);
    return { success: true, quests };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quests:create', async (_event, title, type, xpReward) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const quest = createQuest(user.id, title, type, xpReward);
    return { success: true, quest };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quests:complete', async (_event, questId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    // Check if already completed before we mark it done (to avoid double XP)
    const existing = getQuests(user.id).find(q => q.id === questId);
    const wasAlreadyDone = existing?.completed_at != null;
    const quest = completeQuest(questId, user.id);
    if (!quest) return { success: false, error: 'Quest not found' };
    // Add XP only on first completion
    if (!wasAlreadyDone) updateUserXP(user.id, quest.xp_reward);
    // Sync XP to Supabase
    try {
      const { supabase } = await import('../lib/supabase.js');
      const profile = getUserProfile(user.id);
      await supabase.from('user_profile').update({
        total_xp: profile.total_xp,
        level: profile.level
      }).eq('id', user.id);
    } catch (e) {
      debugLog(`quests:complete — Supabase XP sync failed: ${e.message}`);
    }
    const profile = getUserProfile(user.id);
    return { success: true, quest, xpEarned: quest.xp_reward, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quests:uncomplete', async (_event, questId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const quest = uncompleteQuest(questId, user.id);
    return { success: true, quest };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quests:delete', async (_event, questId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    deleteQuest(questId, user.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Session tasks (checklist) IPC ─────────────────────────────────────────────

ipcMain.handle('tasks:list', async (_event, sessionId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const sessionRow = getSessionById(sessionId);
    if (!sessionRow || sessionRow.user_id !== user.id) {
      return { success: false, error: 'Session not found' };
    }
    const tasks = getTasksBySession(sessionId);
    return { success: true, tasks };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tasks:listAll', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const tasks = getTasksByUser(user.id);
    return { success: true, tasks };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tasks:add', async (_event, sessionId, text) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const active = getActiveSession();
    if (!active || active.id !== sessionId) {
      return { success: false, error: 'no active session' };
    }
    const sessionRow = getSessionById(sessionId);
    if (!sessionRow || sessionRow.user_id !== user.id || sessionRow.ended_at != null) {
      return { success: false, error: 'no active session' };
    }
    const task = createTask(sessionId, user.id, text);
    if (!task) return { success: false, error: 'empty text' };
    return { success: true, task };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tasks:toggle', async (_event, taskId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const task = toggleTask(taskId, user.id);
    if (!task) return { success: false, error: 'Task not found' };
    return { success: true, task };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tasks:delete', async (_event, taskId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const ok = deleteTask(taskId, user.id);
    if (!ok) return { success: false, error: 'Task not found' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Session notes (quick capture during focus) ────────────────────────────────

ipcMain.handle('notes:list', async (_event, sessionId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const sessionRow = getSessionById(sessionId);
    if (!sessionRow || sessionRow.user_id !== user.id) {
      return { success: false, error: 'Session not found' };
    }
    const notes = getNotesBySession(sessionId);
    return { success: true, notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes:listAll', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const notes = getNotesByUser(user.id);
    return { success: true, notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes:add', async (_event, sessionId, text) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const active = getActiveSession();
    if (!active || active.id !== sessionId) {
      return { success: false, error: 'no active session' };
    }
    const note = createNote(sessionId, user.id, text);
    if (!note) return { success: false, error: 'empty text' };
    return { success: true, note };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes:delete', async (_event, noteId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const ok = deleteNote(noteId, user.id);
    if (!ok) return { success: false, error: 'Note not found' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Daily Jobs ────────────────────────────────────────────────────────────────
// Called once per calendar day on app open.
// Runs: quest resets → daily AI signal generation.

async function runDailyJobs(userId) {
  const today = getLocalDayWindow(0);
  const yesterday = getLocalDayWindow(-1);
  const todayStr = today.dateStr;
  const lastRun = getLastDailyJobDate(userId);
  if (lastRun === todayStr) return; // already ran today

  debugLog(`runDailyJobs: running for ${userId} on ${todayStr}`);

  // 1. Reset daily quests
  const resetIds = resetDailyQuests(userId, todayStr);
  if (resetIds.length > 0) {
    debugLog(`runDailyJobs: reset ${resetIds.length} daily quest(s)`);
    [floatingWindow, fullWindow].forEach(w =>
      w?.webContents.send('quests:dailyReset', { resetIds })
    );
  }

  // 2. Generate daily AI signal
  try {
    await generateDailySignal(userId, todayStr, yesterday);
  } catch (e) {
    debugLog(`runDailyJobs: daily signal failed: ${e.message}`);
  }

  // 3. Generate yesterday's memory snapshot (runs after signal, sequential)
  try {
    await generateMemorySnapshot(userId, yesterday);
  } catch (e) {
    debugLog(`runDailyJobs: memory snapshot failed: ${e.message}`);
  }

  setLastDailyJobDate(userId, todayStr);
}

function getLocalDayWindow(offsetDays = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    dateStr: start.toLocaleDateString('en-CA'),
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

// Determine signal intensity based on the previous full local day vs the last 7 full local days.
// Low  = yesterday < 50% of 7d avg (or no sessions)
// Med  = 50–120% of 7d avg
// High = > 120% of 7d avg
async function computeSignalIntensity(supabase, userId) {
  const yesterday = getLocalDayWindow(-1);
  const today = getLocalDayWindow(0);
  const sevenDaysAgo = getLocalDayWindow(-7);

  const { data: yesterdaySessions } = await supabase
    .from('sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', yesterday.startMs)
    .lt('started_at', yesterday.endMs)
    .not('duration_seconds', 'is', null);

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.startMs)
    .lt('started_at', today.startMs)
    .not('duration_seconds', 'is', null);

  const yesterdayMinutes = (yesterdaySessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );

  const weekMinutes = (weekSessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );

  const sevenDayAvg = weekMinutes / 7;

  if (sevenDayAvg === 0 || yesterdayMinutes === 0) return 'low';
  const ratio = yesterdayMinutes / sevenDayAvg;
  if (ratio < 0.5) return 'low';
  if (ratio <= 1.2) return 'med';
  return 'high';
}

async function generateDailySignal(userId, todayStr, yesterday = getLocalDayWindow(-1)) {
  const apiKey = await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT);
  if (!apiKey) {
    debugLog('generateDailySignal: no OpenAI key — skipping');
    return;
  }

  const { supabase } = await import('../lib/supabase.js');

  // Check if signal already exists for today (race guard)
  const { data: existing } = await supabase
    .from('daily_signals')
    .select('id')
    .eq('user_id', userId)
    .eq('date', todayStr)
    .single();

  if (existing) {
    debugLog('generateDailySignal: signal already exists for today');
    return;
  }

  const { data: yesterdaySessions } = await supabase
    .from('sessions')
    .select('task, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', yesterday.startMs)
    .lt('started_at', yesterday.endMs)
    .not('duration_seconds', 'is', null);

  const intensity = await computeSignalIntensity(supabase, userId);

  const profile = getUserProfile(userId);
  const userName = profile?.display_name || 'you';

  let content;

  // Cold start: no prior sessions at all → onboarding welcome
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (!allSessions || allSessions.length === 0) {
    content = `Welcome to Promethee, ${userName}. Start your first session today — every minute you track becomes part of your story.`;
  } else {
    const sessionCount = yesterdaySessions?.length || 0;
    const totalMinutes = (yesterdaySessions || []).reduce(
      (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
    );
    const tasks = (yesterdaySessions || [])
      .map(s => s.task)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    const intensityContext = {
      low: 'Yesterday was light.',
      med: 'Solid day yesterday.',
      high: 'Strong output yesterday.',
    }[intensity];

    const contextText = sessionCount === 0
      ? 'No sessions logged yesterday.'
      : `${sessionCount} session${sessionCount !== 1 ? 's' : ''}, ${totalMinutes} minutes${tasks ? ` — ${tasks}` : ''}.`;

    const prompt = `You are Promethee, an AI mentor for ${userName}. Generate a single short signal (1–2 sentences, max 30 words) for today. ${intensityContext} ${contextText} Be direct, personal, and motivating. No filler phrases. No "I noticed" or "Remember".`;

    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.8,
    });
    content = resp.choices[0]?.message?.content?.trim() || '';
  }

  if (!content) {
    debugLog('generateDailySignal: empty content — skipping insert');
    return;
  }

  const { error } = await supabase.from('daily_signals').insert({
    user_id: userId,
    date: todayStr,
    content,
    intensity,
    created_at: Date.now(),
  });

  if (error) {
    debugLog(`generateDailySignal: insert error: ${error.message}`);
  } else {
    debugLog(`generateDailySignal: inserted signal (${intensity}): ${content.slice(0, 60)}`);
    // Notify renderer so the dashboard card updates without a reload
    [floatingWindow, fullWindow].forEach(w =>
      w?.webContents.send('signal:new', { date: todayStr, content, intensity })
    );
  }
}

// ── Memory Snapshot ───────────────────────────────────────────────────────────
// Called from runDailyJobs() after the daily signal. Writes one row for the previous full local day.

async function generateMemorySnapshot(userId, snapshotDay = getLocalDayWindow(-1), { allowAi = true } = {}) {
  const existing = getMemorySnapshotCacheByDate(userId, snapshotDay.dateStr);
  if (existing) return existing;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Snapshot one full local calendar day from local SQLite (same store as Session log)
  const todaysSessions = getCompletedSessionsInRange(userId, snapshotDay.startMs, snapshotDay.endMs - 1);

  const sessionCount = todaysSessions?.length || 0;
  const totalMinutes = (todaysSessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );

  const allRecentSessions = getCompletedSessionsForSkills(userId, thirtyDaysAgo);

  let peakHours = null;
  if (allRecentSessions && allRecentSessions.length > 0) {
    const hourBuckets = new Array(24).fill(0);
    for (const s of allRecentSessions) {
      const h = new Date(s.started_at).getHours();
      hourBuckets[h]++;
    }
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    peakHours = `${String(peakHour).padStart(2,'0')}:00–${String(peakHour + 1).padStart(2,'0')}:00`;
  }

  const allMinutes = (allRecentSessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );
  const avgDuration = allRecentSessions?.length
    ? Math.round(allMinutes / allRecentSessions.length)
    : 0;

  const thirtyDaysMinutes = allMinutes;
  const rigueur = Math.min(Math.round((thirtyDaysMinutes / 3000) * 100), 100);

  const streak = getUserProfile(userId)?.current_streak || 0;
  const volonte = Math.min(Math.round((streak / 30) * 100), 100);
  const deepCount = (allRecentSessions || []).filter(s => (s.duration_seconds || 0) >= 7200).length;
  const courage = Math.min(Math.round((deepCount / 20) * 100), 100);

  // Quest completion rate from local SQLite so memory generation stays local-first.
  const allQuests = getQuests(userId);
  const questTotal = allQuests.length || 0;
  const questDone = allQuests.filter(q => q.completed_at).length;
  const questRate = questTotal > 0 ? Math.round((questDone / questTotal) * 10000) / 100 : 0;

  // Generate behavioral summary via GPT (only if API key available)
  let behavioralSummary = null;
  const apiKey = allowAi
    ? await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT)
    : null;
  if (apiKey && allRecentSessions && allRecentSessions.length >= 1) {
    try {
      const openai = new OpenAI({ apiKey });
      const prompt = `You are Promethee. Write a 1-sentence behavioral observation about this user based on their last 30 days of work data. Be precise and personal, not generic.

Data:
- Total sessions (30d): ${allRecentSessions.length}
- Total focus minutes (30d): ${allMinutes}
- Avg session duration: ${avgDuration} min
- Peak work hour: ${peakHours || 'unknown'}
- Current streak: ${streak} days
- Deep sessions (≥2h, 30d): ${deepCount}
- Quest completion rate: ${questRate}%

Write one sentence only. No "I" pronoun. No filler.`;

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7,
      });
      behavioralSummary = resp.choices[0]?.message?.content?.trim() || null;
    } catch (e) {
      debugLog(`generateMemorySnapshot: GPT summary failed: ${e.message}`);
    }
  }

  // Emotional tags derived from data patterns
  const emotionalTags = [];
  if (streak >= 7) emotionalTags.push('consistent');
  if (avgDuration >= 90) emotionalTags.push('deep-focused');
  if (deepCount >= 3) emotionalTags.push('marathon-worker');
  if (questRate >= 60) emotionalTags.push('goal-driven');
  if (sessionCount === 0) emotionalTags.push('rest-day');

  const snapshotPayload = {
    user_id: userId,
    snapshot_date: snapshotDay.dateStr,
    behavioral_summary: behavioralSummary,
    emotional_tags: emotionalTags,
    peak_hours: peakHours,
    avg_session_duration_minutes: avgDuration,
    top_skills: { rigueur, volonte, courage },
    quest_completion_rate: questRate,
    streak_at_snapshot: streak,
    session_count: sessionCount,
    total_minutes: totalMinutes,
    created_at: Date.now(),
  };

  const localSnapshot = upsertMemorySnapshotCache(userId, snapshotPayload);

  try {
    const { supabase } = await import('../lib/supabase.js');
    const { error } = await supabase
      .from('memory_snapshots')
      .upsert(snapshotPayload, { onConflict: 'user_id,snapshot_date' });

    if (error) {
      debugLog(`generateMemorySnapshot: remote upsert error: ${error.message}`);
    } else {
      debugLog(`generateMemorySnapshot: snapshot saved for ${snapshotDay.dateStr}`);
    }
  } catch (error) {
    debugLog(`generateMemorySnapshot: remote sync skipped: ${error.message}`);
  }

  return localSnapshot;
}

async function refreshMemorySnapshotCacheFromSupabase(userId) {
  const { supabase } = await import('../lib/supabase.js');
  const { data, error } = await supabase
    .from('memory_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(90);
  if (error) throw error;
  for (const snapshot of data || []) {
    upsertMemorySnapshotCache(userId, snapshot);
  }
  return getMemorySnapshotCache(userId, 90);
}

async function ensureYesterdaySnapshot(userId) {
  const yesterday = getLocalDayWindow(-1);
  const existing = getMemorySnapshotCacheByDate(userId, yesterday.dateStr);
  if (existing) return;

  debugLog(`ensureYesterdaySnapshot: backfilling ${yesterday.dateStr}`);
  await generateMemorySnapshot(userId, yesterday, { allowAi: false });
}

// IPC: fetch memory data for the reveal screen
ipcMain.handle('memory:get', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    await ensureYesterdaySnapshot(user.id);
    const snapshots = getMemorySnapshotCache(user.id, 90);
    void refreshMemorySnapshotCacheFromSupabase(user.id).catch((e) => {
      debugLog(`memory:get remote refresh skipped: ${e.message}`);
    });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = getCompletedSessionsForSkills(user.id, thirtyDaysAgo);
    const profileRow = getUserProfile(user.id);

    const totalMinutes30d = (recentSessions || []).reduce(
      (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
    );
    const streak = profileRow?.current_streak || 0;
    const deepCount = (recentSessions || []).filter(s => (s.duration_seconds || 0) >= 7200).length;

    return {
      success: true,
      snapshots: snapshots || [],
      current: {
        streak,
        totalMinutes30d,
        deepSessions30d: deepCount,
        totalXp: profileRow?.total_xp || 0,
        level: profileRow?.level || 1,
        snapshotCount: snapshots?.length || 0,
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: fetch today's daily signal
// Audio mute toggle — dashboard sends this, main forwards to floating window
ipcMain.on('audio:muteToggle', (_event, isMuted) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('audio:muteToggle', isMuted);
  }
});

ipcMain.handle('signal:getToday', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const todayStr = new Date().toLocaleDateString('en-CA');
    const { supabase } = await import('../lib/supabase.js');

    const { data, error } = await supabase
      .from('daily_signals')
      .select('content, intensity, date')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, signal: data || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
