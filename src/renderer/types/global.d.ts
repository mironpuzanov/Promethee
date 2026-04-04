export {};

declare global {
  interface Window {
    promethee: {
      session: {
        start: (task: string, roomId?: string | null) => Promise<{ success: boolean; session?: any; error?: string }>;
        end: () => Promise<{ success: boolean; session?: any; error?: string }>;
        getToday: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
        getActive: () => Promise<{ success: boolean; session?: any; error?: string }>;
      };
      auth: {
        signIn: (email: string, password: string) => Promise<{ success: boolean; user?: any; error?: string }>;
        signUp: (email: string, password: string) => Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }>;
        sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
        signOut: () => Promise<{ success: boolean; error?: string }>;
        getUser: () => Promise<{ success: boolean; user?: any; error?: string }>;
        setSession: (accessToken: string, refreshToken: string) => Promise<{ success: boolean; user?: any; error?: string }>;
        onAuthSuccess: (callback: (user: any) => void) => () => void;
        onAuthError: (callback: (message: string) => void) => () => void;
        onSignedOut: (callback: () => void) => () => void;
        updateProfile: (updates: { displayName?: string; avatarUrl?: string }) => Promise<{ success: boolean; user?: any; error?: string }>;
        updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
        uploadAvatar: (fileBuffer: ArrayBuffer, mimeType: string) => Promise<{ success: boolean; url?: string; error?: string }>;
      };
      leaderboard: {
        get: () => Promise<{ success: boolean; leaderboard?: any[]; error?: string }>;
        onUpdate: (callback: (data: any) => void) => void;
      };
      presence: {
        getCount: () => Promise<{ success: boolean; count?: number; error?: string }>;
        getRooms: () => Promise<{ success: boolean; rooms?: any[]; roomPresence?: Record<string, any[]>; error?: string }>;
        onCount: (callback: (count: number) => void) => () => void;
        onFeed: (callback: (feed: any[]) => void) => () => void;
      };
      power: {
        onSuspend: (callback: (data: any) => void) => void;
        onResume: (callback: () => void) => void;
      };
      db: {
        getSessions: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
        getUserProfile: () => Promise<{ success: boolean; profile?: any; error?: string }>;
      };
      window: {
        close: () => Promise<void>;
        minimize: () => Promise<void>;
        toggleFullWindow: () => Promise<void>;
        setIgnoreMouseEvents: (ignore: boolean) => void;
        setFocusable: (focusable: boolean) => void;
        openSessionComplete: (data: { task: string; durationSeconds: number; xpEarned: number; multiplier?: number; streakBonus?: number; depthBonus?: number; currentStreak?: number }) => Promise<{ success: boolean }>;
        onSessionComplete: (callback: (data: { task: string; durationSeconds: number; xpEarned: number; multiplier?: number; streakBonus?: number; depthBonus?: number; currentStreak?: number }) => void) => () => void;
        getPendingSessionComplete: () => Promise<{ task: string; durationSeconds: number; xpEarned: number; multiplier?: number; streakBonus?: number; depthBonus?: number; currentStreak?: number } | null>;
        resizeForSessionComplete: () => Promise<{ success: boolean }>;
        restoreFromSessionComplete: () => Promise<{ success: boolean }>;
        captureSessionCard: () => Promise<{ success: boolean; dataUrl?: string }>;
        copyImageToClipboard: () => Promise<{ success: boolean }>;
        copyImageAndText: (text: string) => Promise<{ success: boolean }>;
        openExternal: (url: string) => Promise<{ success: boolean }>;
        copyText: (text: string) => Promise<{ success: boolean }>;
        startFocusSession: (roomId?: string | null) => Promise<{ success: boolean }>;
        onFocusTaskInput: (callback: (data: { roomId: string | null }) => void) => () => void;
      };
      memory: {
        get: () => Promise<{ success: boolean; snapshots?: any[]; current?: any; error?: string }>;
      };
      habits: {
        list: () => Promise<{ success: boolean; habits?: any[]; error?: string }>;
        create: (title: string, frequency: string) => Promise<{ success: boolean; habit?: any; error?: string }>;
        complete: (habitId: string) => Promise<{ success: boolean; habit?: any; error?: string }>;
        uncomplete: (habitId: string) => Promise<{ success: boolean; habit?: any; error?: string }>;
        delete: (habitId: string) => Promise<{ success: boolean; error?: string }>;
      };
      skills: {
        get: () => Promise<{ success: boolean; skills?: { rigueur: number; volonte: number; courage: number }; raw?: { totalMinutes: number; streak: number; deepSessions: number }; error?: string }>;
      };
      signal: {
        getToday: () => Promise<{ success: boolean; signal?: { content: string; intensity: 'low' | 'med' | 'high'; date: string } | null; error?: string }>;
        onNew: (callback: (data: { date: string; content: string; intensity: 'low' | 'med' | 'high' }) => void) => () => void;
      };
      quests: {
        list: () => Promise<{ success: boolean; quests?: any[]; error?: string }>;
        create: (title: string, type: string, xpReward: number) => Promise<{ success: boolean; quest?: any; error?: string }>;
        complete: (questId: string) => Promise<{ success: boolean; quest?: any; xpEarned?: number; profile?: any; error?: string }>;
        uncomplete: (questId: string) => Promise<{ success: boolean; quest?: any; error?: string }>;
        delete: (questId: string) => Promise<{ success: boolean; error?: string }>;
        onDailyReset: (callback: (data: { resetIds: string[] }) => void) => () => void;
      };
      agent: {
        getToken: () => Promise<{ success: boolean; token?: string; error?: string }>;
        setToken: (key: string) => Promise<{ success: boolean; error?: string }>;
        getChats: () => Promise<{ success: boolean; chats?: any[]; error?: string }>;
        getOrCreateChat: (title: string, sessionId: string | null, systemPrompt: string) => Promise<{ success: boolean; chat?: any; error?: string }>;
        createChat: (title: string, sessionId: string | null, systemPrompt: string) => Promise<{ success: boolean; chat?: any; error?: string }>;
        getMessages: (chatId: string) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
        sendMessage: (chatId: string, content: string, messages: any[]) => Promise<{ success: boolean; error?: string }>;
        onChunk: (callback: (data: { chatId: string; delta: string }) => void) => () => void;
        onStreamEnd: (callback: (data: { chatId: string; message: any }) => void) => () => void;
        onStreamError: (callback: (data: { chatId: string; error: string }) => void) => () => void;
      };
    };
  }
}
