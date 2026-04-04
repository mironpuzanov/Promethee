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
import { getTodaysSessions, getSessions, getUserProfile, initializeDatabase, getAgentChats, getOrCreateAgentChat, createAgentChat, getAgentMessages, addAgentMessage, getQuests, createQuest, completeQuest, uncompleteQuest, deleteQuest, resetDailyQuests, setLastDailyJobDate, getLastDailyJobDate, updateStreak, updateUserXP } from './db.js';
import keytar from 'keytar';
import OpenAI from 'openai';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// Commented out for now as it's causing issues with ES modules
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

let floatingWindow = null;
let fullWindow = null;
let tray = null;

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
      contextIsolation: true
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
  const h = sessionComplete ? 620 : 800;
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
      // Run once-per-day jobs (quest resets, etc.)
      runDailyJobs(user.id).catch(e => debugLog(`runDailyJobs error: ${e.message}`));
    }
  } catch (error) {
    debugLog(`Failed to restore user session: ${error.message}`);
    createFloatingWindow();
    createFullWindow();
  }

  setupPowerMonitoring(floatingWindow);
  setupLeaderboardPolling();
  setupPresence(floatingWindow);

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
  const user = getCurrentUser();
  if (user) await removePresence(user.id);
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

    // Post to live feed + start heartbeat
    await postToLiveFeed(task, roomId);
    await sendHeartbeat(roomId);

    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session:end', async () => {
  try {
    const user = getCurrentUser();
    const session = await endSessionAndSync();

    // Remove presence when session ends
    if (user) await removePresence(user.id);

    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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
        if (fullWindow) fullWindow.close();
        createFullWindow();
        floatingWindow?.hide();
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
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:signOut', async () => {
  try {
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
    fullWindow.setSize(1200, 800, true);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    fullWindow.setPosition(
      Math.round((width - 1200) / 2),
      Math.round((height - 800) / 2),
      true
    );
    fullWindow.setResizable(true);
  }
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

    let resolvedSystemPrompt;
    if (activeSession) {
      const elapsedMinutes = Math.floor((Date.now() - activeSession.startedAt) / 60000);
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${activeSession.task || 'Untitled'}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.
Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
    } else {
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck.

Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
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

    let resolvedSystemPrompt;
    if (activeSession) {
      const elapsedMinutes = Math.floor((Date.now() - activeSession.startedAt) / 60000);
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${activeSession.task || 'Untitled'}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.
Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
    } else {
      resolvedSystemPrompt = `You are the Promethee AI agent. You help users stay focused and get unstuck.

Today: ${xpToday} XP earned across ${sessionCountToday} session${sessionCountToday !== 1 ? 's' : ''}.
User level: ${level} (${totalXp} XP total).
Recent sessions: ${recentNames || 'none yet'}.

Answer concisely.`;
    }

    // Build the final user message with text + image content blocks
    const userContent = [
      { type: 'text', text: content },
      ...images.map(dataUrl => ({
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'auto' }
      }))
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
// Rigueur  = total session minutes (last 30d), 0–100 on 3000-min ceiling
// Volonté  = current_streak (from Supabase user_profile), 0–100 on 30-day ceiling
// Courage  = count of sessions ≥ 2h (last 30d), 0–100 on 20-session ceiling
// All data sourced from Supabase (not SQLite) to avoid cross-store joins.

ipcMain.handle('skills:get', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { supabase } = await import('../lib/supabase.js');
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Fetch last 30 days of sessions from Supabase
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('duration_seconds, started_at')
      .eq('user_id', user.id)
      .gte('started_at', thirtyDaysAgo)
      .not('duration_seconds', 'is', null);

    if (sessErr) throw sessErr;

    // Fetch user_profile for streak
    const { data: profileRow, error: profErr } = await supabase
      .from('user_profile')
      .select('current_streak')
      .eq('id', user.id)
      .single();

    if (profErr && profErr.code !== 'PGRST116') throw profErr;

    const streak = profileRow?.current_streak || 0;

    // Rigueur: total session minutes
    const totalMinutes = (sessions || []).reduce((sum, s) => {
      return sum + Math.floor((s.duration_seconds || 0) / 60);
    }, 0);
    const rigueur = Math.min(Math.round((totalMinutes / 3000) * 100), 100);

    // Volonté: streak days
    const volonte = Math.min(Math.round((streak / 30) * 100), 100);

    // Courage: sessions ≥ 2 hours (7200 seconds)
    const deepSessions = (sessions || []).filter(s => (s.duration_seconds || 0) >= 7200).length;
    const courage = Math.min(Math.round((deepSessions / 20) * 100), 100);

    return {
      success: true,
      skills: { rigueur, volonte, courage },
      raw: { totalMinutes, streak, deepSessions }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── Habits IPC Handlers ───────────────────────────────────────────────────────
// Habits live in Supabase only (no SQLite). Completion tracked by local date.

ipcMain.handle('habits:list', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { supabase } = await import('../lib/supabase.js');
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return { success: true, habits: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:create', async (_event, title, frequency) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { supabase } = await import('../lib/supabase.js');
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: user.id, title, frequency: frequency || 'daily', created_at: Date.now() })
      .select()
      .single();
    if (error) throw error;
    return { success: true, habit: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:complete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { supabase } = await import('../lib/supabase.js');

    // Fetch current habit
    const { data: habit, error: fetchErr } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .eq('user_id', user.id)
      .single();
    if (fetchErr) throw fetchErr;

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    // Already completed today
    if (habit.last_completed_date === todayStr) {
      return { success: true, habit };
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    let newStreak = habit.last_completed_date === yesterdayStr
      ? (habit.current_streak || 0) + 1
      : 1;

    const { data: updated, error: updateErr } = await supabase
      .from('habits')
      .update({ last_completed_date: todayStr, current_streak: newStreak })
      .eq('id', habitId)
      .select()
      .single();
    if (updateErr) throw updateErr;

    return { success: true, habit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:uncomplete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { supabase } = await import('../lib/supabase.js');

    const todayStr = new Date().toLocaleDateString('en-CA');

    const { data: habit } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .eq('user_id', user.id)
      .single();

    // Only allow uncompleting if completed today
    if (!habit || habit.last_completed_date !== todayStr) {
      return { success: false, error: 'Not completed today' };
    }

    const newStreak = Math.max(0, (habit.current_streak || 1) - 1);
    const { data: updated, error } = await supabase
      .from('habits')
      .update({ last_completed_date: null, current_streak: newStreak })
      .eq('id', habitId)
      .select()
      .single();
    if (error) throw error;

    return { success: true, habit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('habits:delete', async (_event, habitId) => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { supabase } = await import('../lib/supabase.js');
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', user.id);
    if (error) throw error;
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

// ── Daily Jobs ────────────────────────────────────────────────────────────────
// Called once per calendar day on app open.
// Runs: quest resets → daily AI signal generation.

async function runDailyJobs(userId) {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
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
    await generateDailySignal(userId, todayStr);
  } catch (e) {
    debugLog(`runDailyJobs: daily signal failed: ${e.message}`);
  }

  // 3. Generate memory snapshot (runs after signal, sequential)
  try {
    await generateMemorySnapshot(userId, todayStr);
  } catch (e) {
    debugLog(`runDailyJobs: memory snapshot failed: ${e.message}`);
  }

  setLastDailyJobDate(userId, todayStr);
}

// Determine signal intensity based on yesterday's total session minutes vs 7-day avg.
// Low  = yesterday < 50% of 7d avg (or no sessions)
// Med  = 50–120% of 7d avg
// High = > 120% of 7d avg
async function computeSignalIntensity(supabase, userId) {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const yesterdayStart = now - 2 * oneDayMs;
  const yesterdayEnd = now - oneDayMs;
  const sevenDaysAgo = now - 7 * oneDayMs;

  const { data: yesterdaySessions } = await supabase
    .from('sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', yesterdayStart)
    .lt('started_at', yesterdayEnd)
    .not('duration_seconds', 'is', null);

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo)
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

async function generateDailySignal(userId, todayStr) {
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

  // Build context: yesterday's sessions + quests completed
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayStart = now - 2 * oneDayMs;
  const yesterdayEnd = now - oneDayMs;

  const { data: yesterdaySessions } = await supabase
    .from('sessions')
    .select('task, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', yesterdayStart)
    .lt('started_at', yesterdayEnd)
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

    const prompt = `You are Prométhée, an AI mentor for ${userName}. Generate a single short signal (1–2 sentences, max 30 words) for today. ${intensityContext} ${contextText} Be direct, personal, and motivating. No filler phrases. No "I noticed" or "Remember".`;

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
// Called from runDailyJobs() after the daily signal. Writes one row per day.

async function generateMemorySnapshot(userId, todayStr) {
  const { supabase } = await import('../lib/supabase.js');

  // Idempotency guard
  const { data: existing } = await supabase
    .from('memory_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('snapshot_date', todayStr)
    .single();
  if (existing) return;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayStart = now - oneDayMs; // yesterday's data is the "day" we're snapshotting
  const thirtyDaysAgo = now - 30 * oneDayMs;

  // Yesterday's sessions (for today's snapshot we record what happened today so far;
  // snapshot runs at first-open which may be early, so we use the rolling 24h window)
  const { data: todaysSessions } = await supabase
    .from('sessions')
    .select('task, duration_seconds, started_at')
    .eq('user_id', userId)
    .gte('started_at', todayStart)
    .lte('started_at', now)
    .not('duration_seconds', 'is', null);

  const sessionCount = todaysSessions?.length || 0;
  const totalMinutes = (todaysSessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );

  // Peak hour: find the hour-of-day with most session starts in the last 30 days
  const { data: allRecentSessions } = await supabase
    .from('sessions')
    .select('started_at, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', thirtyDaysAgo)
    .not('duration_seconds', 'is', null);

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

  // Average session duration (30d)
  const allMinutes = (allRecentSessions || []).reduce(
    (s, r) => s + Math.floor((r.duration_seconds || 0) / 60), 0
  );
  const avgDuration = allRecentSessions?.length
    ? Math.round(allMinutes / allRecentSessions.length)
    : 0;

  // Skill scores snapshot
  const thirtyDaysMinutes = allMinutes;
  const rigueur = Math.min(Math.round((thirtyDaysMinutes / 3000) * 100), 100);

  const { data: profileRow } = await supabase
    .from('user_profile')
    .select('current_streak')
    .eq('id', userId)
    .single();
  const streak = profileRow?.current_streak || 0;
  const volonte = Math.min(Math.round((streak / 30) * 100), 100);
  const deepCount = (allRecentSessions || []).filter(s => (s.duration_seconds || 0) >= 7200).length;
  const courage = Math.min(Math.round((deepCount / 20) * 100), 100);

  // Quest completion rate (all time)
  const { data: allQuests } = await supabase
    .from('quests')
    .select('completed_at')
    .eq('user_id', userId);
  const questTotal = allQuests?.length || 0;
  const questDone = (allQuests || []).filter(q => q.completed_at).length;
  const questRate = questTotal > 0 ? Math.round((questDone / questTotal) * 10000) / 100 : 0;

  // Generate behavioral summary via GPT (only if API key available)
  let behavioralSummary = null;
  const apiKey = await keytar.getPassword(AGENT_KEYCHAIN_SERVICE, AGENT_KEYCHAIN_ACCOUNT);
  if (apiKey && allRecentSessions && allRecentSessions.length >= 1) {
    try {
      const openai = new OpenAI({ apiKey });
      const prompt = `You are Prométhée. Write a 1-sentence behavioral observation about this user based on their last 30 days of work data. Be precise and personal, not generic.

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

  const { error } = await supabase.from('memory_snapshots').insert({
    user_id: userId,
    snapshot_date: todayStr,
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
  });

  if (error) {
    debugLog(`generateMemorySnapshot: insert error: ${error.message}`);
  } else {
    debugLog(`generateMemorySnapshot: snapshot saved for ${todayStr}`);
  }
}

// IPC: fetch memory data for the reveal screen
ipcMain.handle('memory:get', async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { supabase } = await import('../lib/supabase.js');

    // All snapshots, newest first
    const { data: snapshots, error } = await supabase
      .from('memory_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: false })
      .limit(90);

    if (error) throw error;

    // Latest skills + streak for current state
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('duration_seconds, started_at')
      .eq('user_id', user.id)
      .gte('started_at', thirtyDaysAgo)
      .not('duration_seconds', 'is', null);

    const { data: profileRow } = await supabase
      .from('user_profile')
      .select('current_streak, total_xp, level, display_name')
      .eq('id', user.id)
      .single();

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
