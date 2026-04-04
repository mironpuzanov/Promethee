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
import { getTodaysSessions, getSessions, getUserProfile, initializeDatabase, getAgentChats, getOrCreateAgentChat, createAgentChat, getAgentMessages, addAgentMessage } from './db.js';
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
          // Close login window, open dashboard, keep overlay hidden until dashboard closes
          if (fullWindow) {
            fullWindow.close();
          }
          floatingWindow?.webContents.send('auth:success', user);
          // Open dashboard as the first thing user sees after login
          createFullWindow();
          floatingWindow?.hide();
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
    }
  } catch (error) {
    debugLog(`Failed to restore user session: ${error.message}`);
    createFloatingWindow();
    createFullWindow();
  }

  setupPowerMonitoring(floatingWindow);
  setupLeaderboardPolling(floatingWindow);
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
    const user = await getUser();
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
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.close();
  }
});

ipcMain.handle('window:minimize', () => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.minimize();
  }
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
