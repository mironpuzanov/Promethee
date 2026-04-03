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
    openSessionComplete: (sessionData) => ipcRenderer.invoke('window:openSessionComplete', sessionData),
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleFullWindow: () => ipcRenderer.invoke('window:toggleFullWindow'),
    setIgnoreMouseEvents: (ignore) => {
      ipcRenderer.send(ignore ? 'set-ignore-mouse-events-true' : 'set-ignore-mouse-events-false');
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
  }
});
