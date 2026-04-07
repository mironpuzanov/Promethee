# Promethee

Promethee is an Electron desktop app for focused work.

It replaces a Discord + Notion workflow with a native overlay and dashboard: start a session, track tasks and notes, earn XP, build streaks, review memory snapshots, and stay connected to the community leaderboard and rooms.

## Current Product State

What exists in the app today:

- Floating overlay for starting and ending focus sessions
- Full dashboard with Home, Tasks, Mentor, Quests, Habits, Memory, Leaderboard, Rooms, and Settings
- Supabase auth with persisted session restore
- Local SQLite storage for sessions, profile, chats, habits, quests, tasks, and cached memory snapshots
- Local-first behavior for core flows, including offline-safe session start and best-effort sync
- XP, levels, streaks, deep-session bonuses, and skill visualization
- AI mentor chat in both the overlay and dashboard
- Markdown-rendered session notes and task logs
- DMG / ZIP packaging via Electron Forge

Still intentionally incomplete:

- soundscape
- journal tab
- community feed
- achievements / titles logic
- notarized production distribution
- auto-updater

## Stack

- Electron Forge
- Vite
- React
- SQLite via `better-sqlite3`
- Supabase
- OpenAI API

## Getting Started

```bash
npm install
npm start
```

Useful commands:

```bash
npm test
npm run make
```

Notes:

- If `node_modules` is missing, `npm start` will fail until you run `npm install`.
- Dev mode uses Electron Forge + Vite.
- Packaged macOS builds are not code signed or notarized yet, so Gatekeeper will warn.

## Docs

- [BUILD.md](./BUILD.md): live feature checklist and test status
- [BUILD_COMPLETE.md](./BUILD_COMPLETE.md): historical March 31 prototype milestone
- [CHANGELOG.md](./CHANGELOG.md): release history
- [DESIGN.md](./DESIGN.md): design system and visual direction
- [docs/product-spec.md](./docs/product-spec.md): product strategy and wedge
- [docs/roadmap.md](./docs/roadmap.md): rollout roadmap and status updates
- [docs/website-blocker-v1.md](./docs/website-blocker-v1.md): concrete investigation and recommended V1 for website blocking

## Reality Check

This repo is not a generic productivity app starter. It is opinionated around a very specific product:

- identity-driven focus
- social accountability
- local-first desktop behavior
- community migration from an existing Notion + Discord business

If you change the product direction, update the docs with it. The code is moving fast enough that stale docs become lies quickly.
