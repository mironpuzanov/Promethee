import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('promethee', {
  // Session APIs
  session: {
    start: (task) => ipcRenderer.invoke('session:start', task),
    end: () => ipcRenderer.invoke('session:end'),
    getToday: () => ipcRenderer.invoke('session:getToday'),
    getActive: () => ipcRenderer.invoke('session:getActive')
  },

  // Auth APIs
  auth: {
    signIn: (email) => ipcRenderer.invoke('auth:signIn', email),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getUser: () => ipcRenderer.invoke('auth:getUser')
  },

  // Leaderboard APIs
  leaderboard: {
    get: () => ipcRenderer.invoke('leaderboard:get'),
    onUpdate: (callback) => {
      ipcRenderer.on('leaderboard:update', (event, data) => callback(data));
    }
  },

  // Power management
  power: {
    onSuspend: (callback) => {
      ipcRenderer.on('power:suspend', (event, data) => callback(data));
    },
    onResume: (callback) => {
      ipcRenderer.on('power:resume', () => callback());
    }
  },

  // DB APIs
  db: {
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    getUserProfile: () => ipcRenderer.invoke('db:getUserProfile')
  },

  // Window controls
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleFullWindow: () => ipcRenderer.invoke('window:toggleFullWindow'),
    setIgnoreMouseEvents: (ignore) => {
      ipcRenderer.send(ignore ? 'set-ignore-mouse-events-true' : 'set-ignore-mouse-events-false');
    }
  }
});
