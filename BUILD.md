# Promethee — Build Status & Test Checklist
*Last updated: 2026-04-07*

## How to test

`npm install` — install dependencies if `node_modules` is missing.

`npm start` — launches the Electron app in dev mode.

---

## Feature Checklist

### Auth & Onboarding

- [ ] **Sign up** — enter email + password → account created in Supabase, land in overlay
- [ ] **Sign in** — email + password → restores session, no re-login after restart (keychain)
- [ ] **Magic link** — request link by email → "Check your email" step shown
- [ ] **OTP / magic link accounts** — can sign in via magic link if no password set
- [ ] **Startup auth check** — no UI flicker before auth state resolves
- [ ] **Sign out** — clears keychain token, returns to onboarding

---

### Floating Overlay

**Idle state (no session)**
- [ ] Glass pill bottom-center, 24px from edge
- [ ] Level pill (left) — shows current level
- [ ] Presence pill (right) — live "X online" count, updates every 30s
- [ ] "Start a session" expands to task input inline
- [ ] Mentor AI button (left) — opens agent bubble chat
- [ ] Rooms button — opens rooms panel showing who's in each room

**Active session**
- [ ] Timer card bottom-left — countdown ring, task name, elapsed time
- [ ] Level pill top-center
- [ ] Pause / end controls on timer card
- [ ] Overlay follows all Mission Control spaces and fullscreen apps

**Session end**
- [ ] Session end modal — confirm end
- [ ] Session complete screen — full-screen: XP earned, duration, streak badge, depth badge
- [ ] Share card — Twitter, LinkedIn, WhatsApp, Copy Image, Save to disk
- [ ] Close → returns to idle bar

---

### Mentor AI (floating + dashboard)

- [ ] Opens in overlay idle and active states
- [ ] Opens in full MentorTab in dashboard
- [ ] GPT-4o streaming response — tokens appear in real time
- [ ] Typing indicator (three dots) while waiting
- [ ] System prompt includes: task name, elapsed time, today's stats, user profile
- [ ] Current foreground app injected into context before each message
- [ ] **Attach screen** (MentorTab only) — captures display, overlay hides briefly, image sent with next message
- [ ] Chat history persisted to SQLite, loads on reopen
- [ ] Chat list grouped by day, sorted newest first — empty chats hidden
- [ ] API key stored in keychain, configured in Settings

---

### Dashboard — Sidebar navigation

- [ ] Home / Character
- [ ] Session Log
- [ ] Tasks
- [ ] Mentor
- [ ] Community → Leaderboard, Rooms (expandable group)
- [ ] Quests
- [ ] Habits
- [ ] Memory
- [ ] Settings
- [ ] "Start Focus Session" button at bottom of sidebar

---

### Home / Character tab

- [ ] Avatar — uploaded photo or initials fallback
- [ ] Display name + level label
- [ ] XP progress bar to next level
- [ ] Signal intensity dot — Low / Med / High (AI-generated once/day)
- [ ] Skill triangle — Willpower, Consistency, Deep runs — computed from real session history and shown with real values
- [ ] Memory insight teaser → navigates to Memory tab

---

### Right Panel (visible on Home tab)

- [ ] Live presence count — green dot + "X working right now"
- [ ] Live feed — name, task, room, time ago (updates in real time)
- [ ] Active quests — top 3 incomplete quests from DB (hidden if none)
- [ ] Today stats — hours + XP
- [ ] Current streak (days)

---

### Session Log tab

- [ ] All past sessions listed with task, duration, XP
- [ ] Grouped by day

---

### Tasks tab

- [ ] Task checklist per session — shows tasks logged during sessions
- [ ] Toggle task complete / incomplete
- [ ] Grouped by session day

---

### Quests tab

- [ ] Create quest — title, type (daily / mid-term / long-term), XP reward
- [ ] Type color coding — amber (daily), violet (mid), blue (long)
- [ ] Complete quest → XP awarded, no double-XP on re-complete
- [ ] Uncomplete / delete quest
- [ ] XP flash animation on complete
- [ ] Daily quests auto-reset at midnight

---

### Habits tab

- [ ] Create habit — title + frequency (daily / weekly)
- [ ] Mark complete — CheckCircle fills with accent color
- [ ] Uncomplete habit
- [ ] Streak count per habit — flame icon appears at ≥7 days
- [ ] Completed habits visually dimmed
- [ ] Delete habit

---

### Memory tab

- [ ] Stat cards — total sessions, total hours, total XP, top skill
- [ ] Activity chart — last 7 days bar chart
- [ ] Session observations — AI-generated patterns from session history
- [ ] Tag badges from session data
- [ ] Skill bars — all four skills
- [ ] 90-day progress tracker
- [ ] 90-day reveal card (unlocks when enough data)

---

### Leaderboard tab

- [ ] Weekly XP leaderboard — top 50 users
- [ ] Your rank highlighted
- [ ] Updates every 30s, no listener leaks

---

### Rooms tab

- [ ] Room list — deep-work, study, creative
- [ ] Presence count per room — who's in each room + what they're working on
- [ ] Join room from overlay or dashboard

---

### Settings tab

- [ ] Update display name
- [ ] Update password
- [ ] Upload avatar photo
- [ ] OpenAI API key — enter, save to keychain
- [ ] Custom focus shortcuts — configure keyboard shortcut to start/end session

---

### XP & Leveling

- [ ] XP per session = base (10 XP/min) × depth multiplier × streak multiplier
- [ ] Depth bonus — sessions ≥2h get +25%
- [ ] Streak bonus — +10% per day of streak, capped at +50%
- [ ] Combined cap — 2× max
- [ ] Level ladder with tier names
- [ ] XP + level visible in overlay (level pill) and dashboard (character panel)

---

### Passive App Tracking

- [ ] Window tracker samples foreground app every 10s during session, 30s idle
- [ ] Screen Recording permission prompt shown on first use
- [ ] Current app injected into Mentor AI context before each message

---

### Infrastructure / Background

- [ ] SQLite local DB: sessions, user_profile, habits, quests, tasks, agent_chats, agent_messages, local-first habit cache, local-first memory snapshot cache
- [ ] Supabase: auth, user_profile sync, presence, leaderboard, memory_snapshots, daily_signals
- [ ] Heartbeat every 30s during session → Supabase presence
- [ ] Daily job on startup: reset daily quests, update streak, generate AI signal, flush pending syncs
- [ ] Session auto-ends on system suspend
- [ ] `flushPendingSyncs()` on startup — retries all unsynced sessions
- [ ] Session start works offline, sync happens best-effort in background
- [ ] Active session survives app restart

---

## What's NOT built yet

### Soundscape
Ambient audio that responds to session state (idle → building → flow → completion).
Needs AI-generated score first (Suno/Udio). Not built.

### Journal tab
Daily text/voice entry feeding the 90-day memory reveal with emotional context. Schema ready (`memory_snapshots.emotional_tags`), UI not built.

### Community feed
Recent session completions, XP milestones, streaks from other users. Presence + rooms built; feed tab not built.

### Distribution
- Code signing + notarization (needs $99/yr Apple Developer account)
- Auto-updater (Electron `autoUpdater` + GitHub Releases)
- Windows parity (untested — platform-specific window tracking + glass effect needed)

### Achievements / titles
UI partially visible in RightPanel, no logic behind it.

---

## Dev quirks

- Dock tooltip shows "Electron" in dev — correct in `npm run make` packaged build
- `npm run make` produces `.dmg` / `.zip` — no code signing yet (Gatekeeper will warn)
