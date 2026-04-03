# Promethee — Build Status
*Last updated: 2026-04-03*

## What's been built

The prototype is complete and running. `npm start` launches the app.

---

### Electron shell
- Electron Forge + Vite + React + TypeScript
- App name: **Promethee** (set via `app.setName()`, `CFBundleDisplayName`, `forge.config.js`)
- App icon: custom `.icns` with rounded dark bg, white logo, 8% transparent padding (matches 1Password sizing in dock)
- Tray icon: 22×22 template image (white symbol, transparent bg), adapts to light/dark menu bar
- `type: 'panel'` on floating window — follows across all Mission Control spaces and fullscreen apps
- `setAlwaysOnTop(true, 'floating', 1)` — stays on top without covering system UI
- `show: false` on window creation — no flash on startup
- Auth check runs before any window is shown — no blank screen flicker
- `app.setActivationPolicy('regular')` — shows in dock without unhiding other hidden apps
- Tray click opens context menu only (Show Overlay / Quit) — does not toggle windows

---

### Auth (`src/main/auth.js`)
- Magic link only (Supabase `signInWithOtp`)
- Session token stored in OS keychain via `keytar`
- Token restored on app start — no re-login after restart
- `onAuthStateChange` listener syncs state in real time
- OTP code entry supported (for desktop — no browser redirect needed)

---

### SQLite database (`src/main/db.js`)
Schema:
```sql
sessions (id, user_id, task, started_at, ended_at, duration_seconds, xp_earned, source, app_context, synced_at)
user_profile (id, email, display_name, total_xp, level, created_at)
agent_chats (id, user_id, title, session_id, system_prompt, created_at, updated_at)
agent_messages (id, chat_id, role, content, created_at)
```
- `getAgentChats` filters to chats with at least one message (no empty ghost chats)

---

### Sessions (`src/main/session.js`)
- `startSession(task)` — creates SQLite row, returns session object
- `endSession()` — calculates duration + XP (1 XP/min, 0 XP under 60s), writes SQLite, syncs to Supabase
- `flushPendingSyncs()` — on app start, retries all unsynced sessions
- Active session persists across app restarts

---

### Floating overlay (`src/renderer/components/FloatingOverlay/`)
- `IdleBar` — 560×52px glass pill, bottom center, 24px from edge
  - Left: "Mentor AI" button opens AI chat bubble
  - Center: "Start a session" expands to task input
  - Right: Rooms button (shows presence count), user avatar
- `ActiveSession` — timer card bottom left, level pill top center
- `AgentBubble` — AI chat panel, OpenAI streaming via IPC
  - Loads/creates chat per session (`getOrCreateChat`)
  - Streams assistant responses token by token
  - API key stored in keychain
- `RoomsPanel` — shows live rooms with presence counts, join button
- `PresencePill` — live count of online users
- `SessionEndModal` — shown after session ends

---

### Full window dashboard (`src/renderer/components/FullWindow/`)
- `Sidebar` — nav with animated expand/collapse for Community group
  - Order: Home → Sessions → Mentor → Community (Leaderboard, Rooms) → Quests → Habits → Skills → Journal → Settings
- `CharacterPanel` — user name, level, XP bar, stats, today's summary
- `RightPanel` — active session info, quick stats
- `LeaderboardTab` — weekly XP leaderboard, live polling
- `RoomsTab` — room list with presence
- `MentorTab` — full chat history
  - List view: all conversations sorted newest first (empty chats hidden)
  - ChatView: click to read full conversation, back button, scroll to bottom on load
- `SessionLog` — all past sessions with duration and XP
- `SettingsTab` — profile, display name, password change, API key config

---

### AI Mentor (`src/main/index.js` + AgentBubble)
- OpenAI GPT-4o via streaming
- System prompt auto-builds from active session context (task name, elapsed time, today's stats, user profile)
- Chat history persisted to SQLite, loaded on bubble open
- Accessible from both idle and active session states
- Full conversation history readable in MentorTab

---

### Presence + Rooms (`src/main/presence.js`)
- Supabase Realtime presence — heartbeat every 30s
- Live online user count pushed to overlay
- Room creation and joining
- Room presence (who's in each room)

---

### Leaderboard (`src/main/leaderboard.js`)
- Polls Supabase `leaderboard_weekly` view every 30s
- Fetches top 50 + current user's rank
- Pushes updates to renderer via IPC

---

### Power management (`src/main/power.js`)
- Electron `powerMonitor` suspend/resume events
- Session pauses on lid close
- "Resume session?" prompt on wake

---

### Packaging (for distribution)
`forge.config.js` is configured:
```js
packagerConfig: {
  name: 'Promethee',
  executableName: 'Promethee',
  icon: 'src/assets/icon',  // .icns used automatically on macOS
  extendInfo: {
    CFBundleDisplayName: 'Promethee',
    CFBundleName: 'Promethee',
  }
}
```
Run `npm run make` to produce a `.dmg` / `.zip`. No code signing yet (needs Apple Developer Program, $99/year).

---

## What's NOT built yet (post-Paris backlog)

- **Passive window tracking** — detect active app automatically, no manual start/stop
  - macOS: Screen Recording permission + `activeWin` or native API
  - Windows: win32 `GetForegroundWindow`
  - This is the single biggest UX improvement. Must be in Real v1.
- **Hero's journey onboarding** — quiz, quest assignment, "first call to adventure" screen
- **Anatomy model / character** — placeholder silhouette only now
- **Quests system** — UI placeholder only
- **Habits system** — UI placeholder only
- **Skills system** — UI placeholder only
- **Journal** — UI placeholder only
- **Achievements / titles** — partially in RightPanel, no logic
- **Discord data migration** — historical XP/rank from existing community
- **Auto-updater** — Electron `autoUpdater` + GitHub Releases
- **Code signing + notarization** — required for distribution without Gatekeeper warning
- **Onboarding screen** — partial (`OnboardingScreen.tsx` exists, not wired)

---

## Known dev-mode quirks

- Dock tooltip shows "Electron" not "Promethee" — macOS reads from the running binary name, which Forge doesn't rename in dev. Shows correctly in `npm run make` packaged build.
- `npm run make` is the only way to test the final icon, name, and bundle correctly.

---

## File structure (actual)

```
src/
  main/
    index.js          — app entry, all IPC handlers
    preload.js        — contextBridge (window.promethee API)
    auth.js           — Supabase auth + keytar
    session.js        — session start/stop/sync
    db.js             — SQLite schema + queries
    power.js          — suspend/resume events
    leaderboard.js    — Supabase polling
    presence.js       — Supabase Realtime presence + rooms
  renderer/
    App.tsx           — root, mode routing (floating vs full window)
    App.css           — global styles, CSS variables
    components/
      FloatingOverlay/
        index.tsx           — overlay root, session state
        IdleBar.tsx         — idle bar with task input
        AgentBubble.tsx     — AI chat panel
        PresencePill.tsx    — live online count
        RoomsPanel.tsx      — rooms list
        SessionEndModal.tsx — post-session modal
      FullWindow/
        index.tsx           — full window root, tab router
        Sidebar.tsx         — nav sidebar
        CharacterPanel.tsx  — home/character screen
        RightPanel.tsx      — right column
        LeaderboardTab.tsx  — leaderboard
        RoomsTab.tsx        — rooms
        MentorTab.tsx       — chat history
        SessionCompleteScreen.tsx
        SettingsTab.tsx
      OnboardingScreen.tsx  — not yet wired
      ui/
        menu.tsx            — UserProfileSidebar component
        sign-in.tsx         — sign-in form component
  assets/
    icon.icns         — dock icon (macOS)
    icon.png          — dock icon (512×512 PNG)
    tray-icon.png     — menu bar icon (22×22 template)
    tray-icon@2x.png  — menu bar icon retina (44×44 template)
supabase/
  migrations/         — DB schema migrations
docs/
  product-spec.md     — product strategy, roadmap, constraints
  design-spec.md      — UI spec, spacing, colors (locked)
  ui-patterns.md      — design patterns from Nicolas's designs
```
