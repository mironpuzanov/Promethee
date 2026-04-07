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
    signIn: (email, password) => ipcRenderer.invoke('auth:signIn', email, password),
    signUp: (email, password) => ipcRenderer.invoke('auth:signUp', email, password),
    sendMagicLink: (email) => ipcRenderer.invoke('auth:sendMagicLink', email),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    setSession: (accessToken, refreshToken) => ipcRenderer.invoke('auth:setSession', accessToken, refreshToken),
    onAuthSuccess: (callback) => {
      const listener = (_event, user) => callback(user);
      ipcRenderer.on('auth:success', listener);
      return () => ipcRenderer.removeListener('auth:success', listener);
    },
    onAuthError: (callback) => {
      const listener = (_event, message) => callback(message);
      ipcRenderer.on('auth:error', listener);
      return () => ipcRenderer.removeListener('auth:error', listener);
    },
    onSignedOut: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('auth:signed-out', listener);
      return () => ipcRenderer.removeListener('auth:signed-out', listener);
    },
    updateProfile: (updates) => ipcRenderer.invoke('auth:updateProfile', updates),
    updatePassword: (newPassword) => ipcRenderer.invoke('auth:updatePassword', newPassword),
    uploadAvatar: (fileBuffer, mimeType) => ipcRenderer.invoke('auth:uploadAvatar', fileBuffer, mimeType),
  },

  // Leaderboard APIs
  leaderboard: {
    get: () => ipcRenderer.invoke('leaderboard:get'),
    onUpdate: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('leaderboard:update', listener);
      return () => ipcRenderer.removeListener('leaderboard:update', listener);
    }
  },

  // Power management
  power: {
    onSuspend: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('power:suspend', listener);
      return () => ipcRenderer.removeListener('power:suspend', listener);
    },
    onResume: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('power:resume', listener);
      return () => ipcRenderer.removeListener('power:resume', listener);
    }
  },

  // DB APIs
  db: {
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    getUserProfile: () => ipcRenderer.invoke('db:getUserProfile')
  },

  // Window controls
  window: {
    openSessionComplete: (sessionData) => ipcRenderer.invoke('window:openSessionComplete', sessionData),
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleFullWindow: () => ipcRenderer.invoke('window:toggleFullWindow'),
    setIgnoreMouseEvents: (ignore) => {
      ipcRenderer.send(ignore ? 'set-ignore-mouse-events-true' : 'set-ignore-mouse-events-false');
    },
    setFocusable: (focusable) => {
      ipcRenderer.send(focusable ? 'set-focusable-true' : 'set-focusable-false');
    },
    onSessionComplete: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('window:sessionComplete', listener);
      return () => ipcRenderer.removeListener('window:sessionComplete', listener);
    },
    getPendingSessionComplete: () => ipcRenderer.invoke('window:getPendingSessionComplete'),
    resizeForSessionComplete: () => ipcRenderer.invoke('window:resizeForSessionComplete'),
    restoreFromSessionComplete: () => ipcRenderer.invoke('window:restoreFromSessionComplete'),
    captureSessionCard: () => ipcRenderer.invoke('window:captureSessionCard'),
    captureScreen: () => ipcRenderer.invoke('window:captureScreen'),
    clearPendingScreenCapture: () => ipcRenderer.invoke('window:clearPendingScreenCapture'),
    copyImageToClipboard: () => ipcRenderer.invoke('window:copyImageToClipboard'),
    copyImageAndText: (text) => ipcRenderer.invoke('window:copyImageAndText', text),
    openExternal: (url) => ipcRenderer.invoke('window:openExternal', url),
    copyText: (text) => ipcRenderer.invoke('window:copyText', text),
    startFocusSession: (roomId) => ipcRenderer.invoke('window:startFocusFromDashboard', roomId),
    onFocusTaskInput: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('focus:taskInput', listener);
      return () => ipcRenderer.removeListener('focus:taskInput', listener);
    }
  },

  // Presence APIs
  presence: {
    getCount: () => ipcRenderer.invoke('presence:getCount'),
    getRooms: () => ipcRenderer.invoke('presence:getRooms'),
    onCount: (callback) => {
      const listener = (_event, count) => callback(count);
      ipcRenderer.on('presence:count', listener);
      return () => ipcRenderer.removeListener('presence:count', listener);
    },
    onFeed: (callback) => {
      const listener = (_event, feed) => callback(feed);
      ipcRenderer.on('presence:feed', listener);
      return () => ipcRenderer.removeListener('presence:feed', listener);
    }
  },

  // Skills APIs
  skills: {
    get: () => ipcRenderer.invoke('skills:get'),
  },

  // Memory APIs
  memory: {
    get: () => ipcRenderer.invoke('memory:get'),
  },

  // Habits APIs
  habits: {
    list: () => ipcRenderer.invoke('habits:list'),
    create: (title, frequency) => ipcRenderer.invoke('habits:create', title, frequency),
    complete: (habitId) => ipcRenderer.invoke('habits:complete', habitId),
    uncomplete: (habitId) => ipcRenderer.invoke('habits:uncomplete', habitId),
    delete: (habitId) => ipcRenderer.invoke('habits:delete', habitId),
  },

  // Daily signal APIs
  signal: {
    getToday: () => ipcRenderer.invoke('signal:getToday'),
    onNew: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('signal:new', listener);
      return () => ipcRenderer.removeListener('signal:new', listener);
    },
  },

  // Quests APIs
  quests: {
    list: () => ipcRenderer.invoke('quests:list'),
    create: (title, type, xpReward) => ipcRenderer.invoke('quests:create', title, type, xpReward),
    complete: (questId) => ipcRenderer.invoke('quests:complete', questId),
    uncomplete: (questId) => ipcRenderer.invoke('quests:uncomplete', questId),
    delete: (questId) => ipcRenderer.invoke('quests:delete', questId),
    onDailyReset: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('quests:dailyReset', listener);
      return () => ipcRenderer.removeListener('quests:dailyReset', listener);
    }
  },

  // Session checklist tasks (local DB)
  tasks: {
    list: (sessionId) => ipcRenderer.invoke('tasks:list', sessionId),
    listAll: () => ipcRenderer.invoke('tasks:listAll'),
    add: (sessionId, text) => ipcRenderer.invoke('tasks:add', sessionId, text),
    toggle: (taskId) => ipcRenderer.invoke('tasks:toggle', taskId),
    delete: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),
  },

  // Agent APIs
  agent: {
    getToken: () => ipcRenderer.invoke('agent:getToken'),
    setToken: (key) => ipcRenderer.invoke('agent:setToken', key),
    getChats: () => ipcRenderer.invoke('agent:getChats'),
    getOrCreateChat: (title, sessionId, systemPrompt) =>
      ipcRenderer.invoke('agent:getOrCreateChat', title, sessionId, systemPrompt),
    createChat: (title, sessionId, systemPrompt) =>
      ipcRenderer.invoke('agent:createChat', title, sessionId, systemPrompt),
    getMessages: (chatId) => ipcRenderer.invoke('agent:getMessages', chatId),
    sendMessage: (chatId, content, messages) =>
      ipcRenderer.invoke('agent:sendMessage', chatId, content, messages),
    sendMessageWithImages: (chatId, content, images, messages) =>
      ipcRenderer.invoke('agent:sendMessageWithImages', chatId, content, images, messages),
    onChunk: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('agent:chunk', listener);
      return () => ipcRenderer.removeListener('agent:chunk', listener);
    },
    onStreamEnd: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('agent:streamEnd', listener);
      return () => ipcRenderer.removeListener('agent:streamEnd', listener);
    },
    onStreamError: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('agent:streamError', listener);
      return () => ipcRenderer.removeListener('agent:streamError', listener);
    }
  },

  // Window tracking
  tracking: {
    getEvents: (opts) => ipcRenderer.invoke('window:getEvents', opts)
  },

  // Global focus shortcuts (registered in main process)
  shortcuts: {
    get: async () => {
      try {
        return await ipcRenderer.invoke('shortcuts:get');
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'shortcuts:get failed' };
      }
    },
    set: async (partial) => {
      try {
        return await ipcRenderer.invoke('shortcuts:set', partial);
      } catch (e) {
        return {
          success: false,
          error:
            e instanceof Error ? e.message : 'shortcuts:set failed (restart the app if this persists)',
        };
      }
    },
    onFocusShortcut: (callback) => {
      const listener = (_event, action) => callback(action);
      ipcRenderer.on('focusShortcut', listener);
      return () => ipcRenderer.removeListener('focusShortcut', listener);
    },
  },

  // Audio control
  audio: {
    // Dashboard → main → floating window (mute toggle)
    sendMuteToggle: (isMuted) => ipcRenderer.send('audio:muteToggle', isMuted),
    // Floating window listens for mute state from main
    onMuteToggle: (callback) => {
      const listener = (_event, isMuted) => callback(isMuted);
      ipcRenderer.on('audio:muteToggle', listener);
      return () => ipcRenderer.removeListener('audio:muteToggle', listener);
    }
  }
});
