# Promethee — Autonomous Build Instructions
*For Claude Code --dangerously-skip-permissions overnight run*

## Goal
Build the Promethee Electron desktop app prototype. Running on this machine by April 6.
No packaging needed. `npm start` should launch the app.

## Read first
- docs/product-spec.md — full product strategy, stack decisions, constraints
- docs/design-spec.md — UI spec, spacing system, colors, all surfaces
- docs/ui-patterns.md — patterns from Nicolas's actual Promethee designs
- .env — Supabase URL and anon key (already configured)

## What to build

### 1. Project scaffold
- electron-forge with vite + react template
- TypeScript optional, JS is fine
- File structure:
  ```
  src/
    main/         ← Electron main process
      index.js    ← app entry, BrowserWindow setup
      preload.js  ← contextBridge IPC
      session.js  ← session start/stop/flush logic
      auth.js     ← Supabase magic link + keytar
      power.js    ← lid close/resume events
      leaderboard.js ← 30s poll
      db.js       ← SQLite setup + queries
    renderer/     ← React UI
      App.jsx
      components/
        MenubarIcon.jsx
        FloatingOverlay/
          IdleBar.jsx
          ActiveSession.jsx
          LevelPill.jsx
          TimerCard.jsx
        FullWindow/
          Sidebar.jsx
          CharacterPanel.jsx
          RightPanel.jsx
    lib/
      supabase.js ← Supabase client
  ```

### 2. Electron IPC (contextBridge)
- nodeIntegration: false, contextIsolation: true
- preload.js exposes window.promethee with typed channels:
  - session: start(task), end(), getToday()
  - auth: signIn(email), signOut(), getUser()
  - leaderboard: get()
  - power: onSuspend(cb), onResume(cb)
  - db: getSessions()

### 3. SQLite schema (better-sqlite3)
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  xp_earned INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  app_context TEXT,
  synced_at INTEGER
);
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);
```

### 4. Session logic (main/session.js)
- startSession(task): creates session in SQLite, returns id
- endSession(): calculates duration + XP (1 XP/min, min 60s = 0 XP), writes SQLite, attempts Supabase sync
- flushPendingSyncs(): on app start, sync all sessions where synced_at IS NULL
- XP formula: Math.floor(duration_seconds / 60) — sessions under 60s earn 0 XP

### 5. Power management (main/power.js)
- Listen to Electron powerMonitor 'suspend' event → pause active session
- Listen to 'resume' event → send 'power:resume' to renderer
- Renderer shows "Resume session?" prompt with Yes/No

### 6. Auth (main/auth.js)
- Magic link only (no Discord/Google for prototype)
- Supabase signInWithOtp({ email })
- Store session token in OS keychain via keytar
- Load token on app start, restore session if valid
- Expose via preload: signIn(email), signOut(), getUser()

### 7. Leaderboard (main/leaderboard.js)
- Poll every 30 seconds (setInterval)
- Query Supabase leaderboard_weekly view, top 50
- Also fetch current user's rank separately
- Push update to renderer via ipcMain → webContents.send('leaderboard:update', data)

### 8. UI surfaces (follow docs/design-spec.md EXACTLY)

**MenubarIcon:**
- Tray icon using Electron Tray API
- Dot: gray when idle, cyan (#06B6D4) when session active
- Click: show/hide floating overlay

**FloatingOverlay — Idle (IdleBar.jsx):**
- Width: 560px, height: 52px
- Always on top: alwaysOnTop: true, visibleOnAllWorkspaces: true
- Position: bottom center, 24px from bottom
- Background: rgba(16,16,16,0.88) + backdrop blur
- Border: 1px solid rgba(255,255,255,0.07), border-radius: 20px
- Left: orange pill button "🔥 Mentor" (#FF6B35)
- Center: "○  Start a session" clickable text
- Right: user avatar initial + ⋮⋮ dots
- Clicking "Start a session" → shows task input inline → Enter → starts session

**FloatingOverlay — Active (ActiveSession.jsx):**
- LevelPill: top center of screen, 32px tall glass pill, "Level 1 · Apprentice · · · ·"
- TimerCard: bottom left, circular cyan ring, elapsed time, task name, XP so far, stop button
- On stop: end session, show XP earned toast, return to IdleBar

**FullWindow:**
- Open on double-click of tray icon or clicking ⋮⋮
- Full app window, 1200×800, resizable
- Sidebar: black, nav items (Home, Log, Quests, Habits, Skills, Journal, Mentor)
- CharacterPanel: user name, level, XP bar as dots, placeholder silhouette SVG, skills list
- RightPanel: active quest (hardcoded for prototype), titles, today's summary (hours, XP, rank)

### 9. Vitest unit tests
Write tests in src/main/__tests__/session.test.js:
- startSession creates a SQLite record
- endSession calculates XP correctly (1 XP/min)
- endSession with duration < 60s earns 0 XP
- endSession with Supabase offline keeps synced_at null
- flushPendingSyncs retries unsynced sessions
- startSession when session active rejects

### 10. UX testing
After the app builds and runs:
- Use Playwright to launch the Electron app
- Test the full happy path: launch → login screen → enter email → (mock magic link) → home → start session → wait 65s → end session → verify XP earned → verify leaderboard shows
- Test lid close: simulate suspend event → verify session pauses → simulate resume → verify "Resume?" prompt appears
- Test offline sync: disconnect network (or mock Supabase to fail) → end session → verify local XP saved → reconnect → verify synced

## Design system (strict)
From docs/design-spec.md:
- Font: Inter (load from Google Fonts or bundle)
- Background: #0a0a0a
- Surface: rgba(16,16,16,0.88)
- Border: 1px solid rgba(255,255,255,0.07)
- Border radius: overlay=20px, cards=14px, buttons=10px
- Accent orange: #FF6B35 (Mentor button only)
- Accent cyan: #06B6D4 (active timer ring only)
- Text primary: #fff, secondary: #ccc, muted: #666
- Blur: backdrop-filter: blur(24px)
- Padding: overlay=12px 16px, cards=16px 20px, sidebar=10px 16px

## Done when
- `npm start` launches the app
- Menubar icon appears
- Floating overlay appears bottom center
- Can start a session (task input → timer runs)
- Can end a session (XP calculated and shown)
- Leaderboard loads with seed data
- Vitest tests pass
- Playwright UX tests pass
