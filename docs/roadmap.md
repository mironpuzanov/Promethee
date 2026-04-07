# Promethee Roadmap

Generated: 2026-04-02  
Current: Eclipse 3 (Notion template) + La Guilde (Discord, 8,000 members, 7,915 active)  
Goal: Replace Notion as delivery mechanism. Own the software layer.

---

## Status Update (April 7, 2026)

Since this roadmap was written, the app has moved past the original Paris-sprint baseline:

- Onboarding now exists instead of being a Day 1 placeholder.
- Tasks, Habits, Quests, Mentor, and Memory all have live app surfaces rather than "coming soon" shells.
- Session notes/tasks render in-session and in the dashboard, with markdown support.
- Core local-first work is in place for focus sessions, habits, and memory snapshots, so the app remains usable on unstable internet.
- The remaining biggest product gaps are still community feed, achievements/titles logic, soundscape, auto-updater, and notarized distribution.

---

## Baseline: What Exists Today

**App primitives built:**
- Floating overlay: timer, XP pill, session start/end
- Full window: character panel (level, XP progress bar), session log, leaderboard
- Right panel: today stats (time, XP), active quests, streak, live presence/feed
- AI agent chat bubble (GPT-4o, context-aware, per-session history)
- Auth: Supabase onboarding + session restore
- DB: SQLite local + Supabase sync (sessions, user_profile, agent_chats, local-first habits, local-first memory snapshots)

**What the Notion/Discord product has that the app doesn't:**
- Rooms (video + camera presence — this is the #1 feature)
- Skills system (20+ categories: Sommeil, Lecture, Sport, Écriture, Art, Méditation, etc.)
- Session completion dopamine loop (Discord bot XP message on room leave)
- Earned achievements and titles
- Objectives/quests (Kanban board)
- Habits tracker (streak calendar)

---

## Paris Sprint (April 2–6, 2026)

Goal: Demo to co-founder Nicolas on April 7–9. Co-founder alignment, not public launch.

### Day 1 (Apr 2): Onboarding
3-step install: download → magic link auth → first session starts automatically.

**Technical spec:**
- `OnboardingScreen.tsx` shown when `getUser()` returns null
- Single email input + "Send magic link" button
- Deep link callback: `promethee://auth/callback` → `supabase.auth.setSession()` → transition to overlay
- Existing customer import: email match → `flushPendingSyncs` auto-syncs session history
- Target: under 60 seconds from app open to first session running

### Day 2 (Apr 3): Social Presence
"X people working right now" counter + live feed of recent session starts.

**Technical spec:**
- Poll `sessions` table (Supabase) every 30 seconds for active sessions (`ended_at IS NULL, started_at > 30 min ago`)
- Live feed: last 5 session start events from other users ("Alex started 'Deep work' — 3 min ago")
- Wire leaderboard to Supabase instead of local SQLite only
- No WebSockets, no Supabase Realtime — polling is sufficient for Paris

### Session End Modal (Day 1 or 2)
Post-session summary that closes the dopamine loop (replaces Discord bot message).

- Show: task name, duration, XP earned, rank change
- Example: "Deep Work — 1h 23m — +83 XP — you're #4 today"
- 2-hour build, high demo impact

### Day 3–4 (Apr 4–5): Polish
- Smooth rough edges from Days 1–2
- AI agent chat tested end-to-end
- Demo script written

### Day 5 (Apr 6): Freeze
No new code. Travel prep.

---

## Post-Paris: Closed Beta (April 10–21)

Target: 50 existing customers installed, 10 complete a second session.

### P1: Skills System
The Eclipse RPG core. Currently skills in CharacterPanel are hardcoded.

- 20+ skill categories (Sommeil, Lecture, Sport, Écriture, Art, Méditation, Cuisine, etc.)
- Session can be tagged to a skill category
- XP goes to that skill, not just total XP
- Character panel becomes real: each skill has its own level and progress bar
- This replaces the "Skills board" Kanban in Eclipse 3

### P2: Rooms v1 (Text Presence)
The most-used feature in La Guilde is the study rooms. Start with text-based presence.

- "Deep Work room: 3 people inside" — live counter
- Join a room → your session is visible to others in the same room
- See who's in your room, what they're working on
- No video in this version. That's a separate technical problem.

### P3: Achievements
Low-effort, high-dopamine. Trigger on milestones.

- First session, 10 sessions, 100 sessions
- First hour of Deep Work, 10 hours, 100 hours
- Level milestones
- Earned titles that unlock (currently hardcoded)

### P4: Quests
Active quests that track toward a goal. Currently "Coming soon."

- Create a quest with a goal (e.g., "Write 10 hours this week")
- Sessions tagged to relevant skill contribute to quest progress
- Complete quest → XP bonus + achievement

---

## Month 2+: Post-Beta

### Habits Tracker
- Daily/weekly habit streaks
- Calendar heatmap (the "consistency graph" in Eclipse 3)
- Habit completion tied to session types

### Video Rooms
The real Discord replacement. This is significant engineering.

- WebRTC peer-to-peer or LiveKit self-hosted
- Camera-on focus rooms — the core of La Guilde
- Do not start before beta. Requires infrastructure decisions (TURN servers, media relay)

### Auto-Updater
- Electron auto-updater for seamless version updates post-beta
- No app store for initial beta — DMG/ZIP download via Discord

---

## Distribution

- Electron desktop app via electron-forge (existing)
- Beta: DMG/ZIP download link in Discord community
- No Mac App Store or Windows Store for Paris or initial beta

---

## Success Criteria

**Paris (April 7–9):**
- Nicolas says "yes, this is the direction we build"
- Demo: frictionless install → first session → AI agent → social presence → leaderboard
- No crashes

**Closed Beta (April 10–21):**
- 50 existing customers installed and running first session
- 10 complete a second session (retention signal)
- 3+ reach out unprompted (Discord DMs or feedback thread)
