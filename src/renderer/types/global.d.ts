export {};

declare global {
  interface Window {
    promethee: {
      session: {
        start: (task: string) => Promise<{ success: boolean; session?: any; error?: string }>;
        end: () => Promise<{ success: boolean; session?: any; error?: string }>;
        getToday: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
        getActive: () => Promise<{ success: boolean; session?: any; error?: string }>;
      };
      auth: {
        signIn: (email: string) => Promise<{ success: boolean; error?: string }>;
        signOut: () => Promise<{ success: boolean; error?: string }>;
        getUser: () => Promise<{ success: boolean; user?: any; error?: string }>;
      };
      leaderboard: {
        get: () => Promise<{ success: boolean; leaderboard?: any[]; error?: string }>;
        onUpdate: (callback: (data: any) => void) => void;
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
      };
    };
  }
}
