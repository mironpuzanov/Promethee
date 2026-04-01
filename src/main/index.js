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

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import modules
import { startSession, endSessionAndSync, getActiveSession, flushPendingSyncs } from './session.js';
import { signIn, signOut, getUser } from './auth.js';
import { setupPowerMonitoring } from './power.js';
import { setupLeaderboardPolling, stopLeaderboardPolling, getLeaderboard } from './leaderboard.js';
import { getTodaysSessions, getSessions, getUserProfile, initializeDatabase } from './db.js';

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
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    visibleOnAllWorkspaces: true,
    hasShadow: false,
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
  // if (process.env.NODE_ENV === 'development') {
  //   floatingWindow.webContents.openDevTools({ mode: 'detach' });
  // }

  floatingWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    debugLog(`Window failed to load: ${errorCode} ${errorDescription}`);

    // Retry loading if connection refused (Vite not ready yet)
    if (errorCode === -102) { // ERR_CONNECTION_REFUSED
      debugLog('Vite not ready, retrying in 1 second...');
      setTimeout(() => {
        debugLog('Retrying window load...');
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
          floatingWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?mode=floating`);
        }
      }, 1000);
    }
  });

  // Allow clicks to pass through transparent areas — only overlay elements receive events
  floatingWindow.setIgnoreMouseEvents(true, { forward: true });

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
};

const createFullWindow = () => {
  fullWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    transparent: false,
    backgroundColor: '#0a0a0a',
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

  fullWindow.on('closed', () => {
    fullWindow = null;
  });
};

const createTray = () => {
  // Create a simple tray icon using nativeImage
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Overlay',
      click: () => {
        if (floatingWindow) {
          if (floatingWindow.isVisible()) {
            floatingWindow.hide();
          } else {
            floatingWindow.show();
          }
        }
      }
    },
    {
      label: 'Open Dashboard',
      click: () => {
        if (!fullWindow) {
          createFullWindow();
        } else {
          fullWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Promethee');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (floatingWindow) {
      if (floatingWindow.isVisible()) {
        floatingWindow.hide();
      } else {
        floatingWindow.show();
      }
    }
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

debugLog('Setting up app.whenReady handler');

// App lifecycle
app.whenReady().then(async () => {
  debugLog('=== App is ready, starting initialization ===');
  try {
    // Initialize database first
    debugLog('Initializing database...');
    initializeDatabase();
    debugLog('Database initialized successfully');

    debugLog('Creating floating window...');
    createFloatingWindow();
    debugLog('Floating window created');

    debugLog('Creating tray...');
    createTray();
    debugLog('Tray created');
  } catch (error) {
    debugLog(`!!! Error during initialization: ${error.message}`);
    debugLog(error.stack);
    console.error('!!! Error during initialization:', error);
    console.error(error.stack);
    throw error;
  }

  // Set up power monitoring
  setupPowerMonitoring(floatingWindow);

  // Set up leaderboard polling
  setupLeaderboardPolling(floatingWindow);

  // Flush pending syncs
  await flushPendingSyncs();

  // Try to restore user session
  try {
    await getUser();
  } catch (error) {
    console.error('Failed to restore user session:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createFloatingWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLeaderboardPolling();
});

// Mouse passthrough for floating overlay
ipcMain.on('set-ignore-mouse-events-true', () => {
  floatingWindow?.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('set-ignore-mouse-events-false', () => {
  floatingWindow?.setIgnoreMouseEvents(false);
});

// IPC Handlers
ipcMain.handle('session:start', async (event, task) => {
  try {
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const session = startSession(user.id, task);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session:end', async () => {
  try {
    const session = await endSessionAndSync();
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

ipcMain.handle('auth:signIn', async (event, email) => {
  try {
    const result = await signIn(email);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:signOut', async () => {
  try {
    const result = await signOut();
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

ipcMain.handle('leaderboard:get', async () => {
  try {
    const leaderboard = await getLeaderboard();
    return { success: true, leaderboard };
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
    createFullWindow();
  } else if (fullWindow.isVisible()) {
    fullWindow.hide();
  } else {
    fullWindow.show();
  }
});
