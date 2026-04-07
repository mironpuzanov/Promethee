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

## What's NOT built yet — Full Product Roadmap

### Built in the V1 sprint (April 4, 2026)
- Quests system — real, Supabase-backed, XP on completion
- Habits system — real, flame streak, daily/weekly
- Skills system — Rigueur/Volonté/Courage, auto-updating from sessions
- XP multipliers — streak (+10%/day, cap +50%) × depth (≥2h → +25%), combined cap 2×
- Daily AI signal — Low/Med/High intensity, generated once/day in runDailyJobs()
- 90-day memory pipeline — snapshot job + MemoryTab reveal screen
- Onboarding — wired end-to-end

---

### Layer 1 — Invisible Loop (passive tracking)

**Passive window tracking** — sampling the foreground app into SQLite (`window_events`), surfaced on session complete and in the home right panel ("Apps today"). Uses `active-win` on macOS (Screen Recording permission); fails soft on other OSes.

- Polling: **30s** when idle, **10s** during an active focus session (`src/main/windowTracker.js`). Each poll writes one row (time-sample distribution, not only on app change).
- Tracking starts after auth: cold start (`getUser`), password sign-in, and **`auth:setSession`** (magic link / OTP).
- **Agent context:** before each chat message, main process calls **`getCurrentApp()`** so the system prompt always has the current foreground app, not just DB samples (`agent:sendMessage` and `agent:sendMessageWithImages`).
- **Vision context (MentorTab):** "Attach screen" grabs a **`desktopCapturer`** thumbnail (full screen) and sends via **`sendMessageWithImages`**. Floating `AgentBubble` still attaches images via file picker only.

**Level 3 (future, not implemented):** macOS Accessibility API beyond window title — selected text, focused field, browser URL (Raycast / Superwhisper-style). Requires explicit accessibility permission UX, higher privacy surface, and careful trust boundaries. Keep `active-win` + optional screen attach until product demands deeper context.

- Overlay prompt ("You've been working on [app]… start tracking?") and idle auto-pause: **not built**
- Windows parity: **untested**

Status: **partial — macOS sampling + agent hooks shipped**; prompt-on-detect and Windows still open

---

### Layer 2 — Character & Visual Identity

**Skill tree as the character** — no human silhouette (too literal). The Rigueur/Volonté/Courage
system is the character. Visual direction TBD with Nicolas — likely geometric/abstract, not humanoid.
Skills already update from real data. The visual representation is the open question.

Status: **skill logic built**, visual representation deferred to post-Paris design session

---

### Layer 3 — Soundscape (the world)

Ambient audio that responds to session state. The feature people will describe to friends:
"The music changes when you're in the zone."

**Music source options:**
- AI-generated: Suno / Udio / ElevenLabs Sound Effects — generate a custom Promethee score.
  Full control over mood, no licensing issues. "Weightless" (Marconi Union) style — generative
  ambient that doesn't distract. ~30-60 min of unique material per state.
- Licensed ambient: Epidemic Sound, Artlist — clean licensing, less unique
- Decision: AI-generated preferred. Gives Promethee a sound identity nobody else has.

**Session state → audio mapping:**
- Idle / pre-session: silence
- Session start: subtle activation cue (1-2 seconds, system-boot feel)
- Active session (0-20 min): low ambient texture, barely audible
- Building (20-45 min): score builds imperceptibly, slight rhythmic pulse
- Flow state (45+ min): cinematic depth, music is present but not distracting
- Session end: distinct resolution moment — not a notification, a reward beat

**Implementation:**
- Electron: Web Audio API in renderer, audio files bundled with the app
- Volume: user-controlled in Settings, default 20%
- No external streaming — everything local, no latency, no dependency

Status: **not built** — needs music generation first, then audio engine

---

### Layer 4 — In-App Community (Discord rebuild, focused)

Not a full Discord clone. Just the three things Discord gives users that matter:
1. **Live presence** — who's working right now, how many people, names/avatars
2. **Study rooms** — join a room, silent co-working, see session timers of others
3. **Community feed** — what did people accomplish today (session completions, XP milestones, streaks)

Discord stays as the social/chat layer. This replaces only the accountability infrastructure.
Required when user base exceeds ~10k — Discord becomes unmanageable at scale and excludes
users who don't want to join a Discord server.

- Supabase Realtime for presence (already partially built in `presence.js`)
- Rooms: extend existing RoomsTab — already has join/leave, just needs full UI
- Feed: new FeedTab, polls `sessions` + `user_profile` for recent completions

Status: **presence + rooms partially built**, feed not built

---

### Journal

Voice/text daily narrative. Feeds the 90-day memory reveal with emotional/contextual data
(not just behavioral). Nicolas's V2 spec item, buildable now.

- Daily journal entry: text or voice (Web Speech API or Whisper)
- Weekly report: 3 insights → 3 behavior changes, generated by Prométhée from journal + sessions
- Recurring pattern visualization: topics/themes that appear across entries over time
- Feeds `memory_snapshots.emotional_tags` — already in the schema

Status: **not built** — schema ready, UI needed

---

### Distribution & Platform

**macOS:**
- Code signing + notarization — required for Gatekeeper-free install ($99/yr Apple Developer)
- Auto-updater — Electron `autoUpdater` + GitHub Releases
- Status: not set up

**Windows:**
- 80% of codebase runs identically on Windows
- Platform-specific work needed:
  - Passive window tracking: `GetForegroundWindow` instead of `activeWin`
  - Glass/vibrancy: no native blur on Windows, approximate with CSS
  - Code signing: EV certificate for SmartScreen (separate from Apple)
  - Tray icon: works, minor sizing differences
- Status: untested, not built for Windows-specific paths
- Decision: macOS-first intentionally for beta. Windows parity before public launch.

**Other:**
- Hero's journey onboarding — quiz, quest assignment, "first call to adventure" screen
- Achievements / titles — partially in RightPanel, no logic
- Discord data migration — historical XP/rank from existing 2,500 customers
- Mobile companion (V2) — read-only stats, streak check, daily signal. iOS/Android.

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
