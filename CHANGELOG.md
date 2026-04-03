# Changelog

All notable changes to Promethee are documented here.

## [1.1.0] - 2026-04-03

### Added
- **XP/Level system** — real tier ladder (Apprentice → Initiate → Seeker → Warrior → Champion → Legend), scaling formula N*(N-1)/2 * 100 XP per level. Single source of truth in `src/lib/xp.ts`
- **Mentor AI pill** — floating overlay now shows "Mentor AI" text pill instead of broken icon circle; clicking Mentor in IdleBar opens the chat
- **Mentor tab** in full window — full chat UI with conversation list and message thread
- **Settings tab** in full window — update display name, avatar URL, and password
- **Profile/password update** — `window.promethee.auth.updateProfile()` and `updatePassword()` wired to Supabase auth
- **HiDPI tray icon** — `@2x` retina version added, createTray uses `addRepresentation` for proper scaling
- **Coming soon labels** — Quests, Habits, Skills, Journal show "coming soon" badge and block navigation
- DESIGN.md — full design system documentation (surfaces, typography, tokens, motion, components)
- Supabase migration adding `avatar_url` column to `user_profile`

### Fixed
- Level calculation in `updateUserXP` was wrong (simple `floor(xp/100)`) — now uses correct scaling formula matching the tier system
- `getAgentChats` no longer returns empty chats (added `EXISTS` subquery filter)
- LevelPill XP progress dots were rendered as text `·` characters — now proper 5px circle elements
- AgentBubble `defaultOpen` prop didn't re-open after first mount — replaced with `openTrigger` counter
