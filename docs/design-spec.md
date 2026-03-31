# Promethee — Design Spec
*Finalized: 2026-03-31*
*Status: APPROVED — ready to implement*

## Design Philosophy

Premium, minimalistic, Apple/Cluely DNA. Every surface feels like it barely exists.
Identity-first product — RPG character sheet that happens to have a timer.
The UI gets out of the way while you work. You only notice it when you need it.

## Language
English only. No French.

---

## Spacing System (strict — use these values everywhere)

```
Base unit: 8px

Padding:
  overlay inner:      12px 16px
  full window cards:  16px 20px
  sidebar items:      10px 16px

Border radius:
  overlay bar:        20px   ← soft rounded rect, NOT full pill
  cards / panels:     14px
  buttons:            10px
  pills (CTA only):   999px

Typography:
  muted label:        11px, #666, letter-spacing: 0.08em
  body:               13px, #ccc, Inter Regular
  key data:           15–16px, #fff, Inter Medium
  timer:              18px, #fff, tabular-nums, Inter Medium
  headline:           22–24px, #fff, Inter Light

Blur:                 backdrop-filter: blur(24px)
Border:               1px solid rgba(255,255,255,0.07)
Surface bg:           rgba(16,16,16,0.88)
Full window bg:       #0a0a0a
Sidebar bg:           #000000

Font: Inter (all weights via variable font)
```

---

## Colors

```
accent-orange:   #FF6B35   — Mentor CTA button only
accent-cyan:     #06B6D4   — Active timer ring only
text-primary:    #ffffff
text-secondary:  #cccccc
text-muted:      #666666
text-faint:      #333333
surface:         rgba(16,16,16,0.88)
border:          rgba(255,255,255,0.07)
bg:              #0a0a0a
```

One accent at a time. Never both orange and cyan visible simultaneously.

---

## Surface 1: Floating Overlay — Idle

```
┌────────────────────────────────────────────────────────────┐
│  [🔥 Mentor]     ○  Start a session              👤  ⋮⋮   │
└────────────────────────────────────────────────────────────┘
```

- Width: 560px, height: 52px
- Background: rgba(16,16,16,0.88), backdrop-filter: blur(24px)
- Border: 1px solid rgba(255,255,255,0.07)
- Border radius: 20px
- Shadow: 0 8px 32px rgba(0,0,0,0.5)
- Position: bottom center of screen, 24px from bottom edge

**Left — Mentor button:**
- Orange gradient pill (#FF6B35 → #E85D20)
- 🔥 icon + "Mentor" label, Inter Medium 13px
- padding: 8px 14px, border-radius: 999px

**Center — Start CTA:**
- "○  Start a session" — hollow circle icon + text
- Color: #888, Inter Regular 13px
- Clickable, expands to task input on click

**Right:**
- User avatar (24px circle)
- ⋮⋮ six-dot Promethee brand mark, #444

---

## Surface 2: Floating Overlay — Active Session

Three elements float over the user's work. Nothing else.

**Level pill — top center:**
```
┌──────────────────────────────────┐
│  Level 1 · Apprentice  · · · ·   │
└──────────────────────────────────┘
```
- Width: fit-content, height: 32px
- Same surface style (glass, 20px radius)
- XP progress as dots (filled = earned, hollow = remaining)
- Position: top center, 16px from top

**Timer + task — bottom left:**
```
┌───────────┐
│    ◯      │   01:24:07
│  cyan     │   Writing investor update
│  ring     │   ──────────────────────
└───────────┘   +48 XP so far
```
- Circular timer: 72px diameter, cyan progress ring (#06B6D4)
- Time elapsed: 18px, #fff, tabular-nums
- Task name: 13px, #ccc
- XP so far: 11px, #666
- Stop button: small square icon, #444, top right of this card
- Card: glass surface, 14px radius, padding 16px 20px
- Position: bottom left, 24px from edges

**Mentor chat — bottom left, above timer card:**
- Visible only when mentor sends a message
- Same glass card style
- Message text: 14px, #fff, no avatar
- Dismisses after 8 seconds or on tap
- Prototype: static/mock message only (no AI)

---

## Surface 3: Menubar Icon

- Promethee ⋮⋮ mark in menubar
- When idle: #666 (muted)
- When active: #06B6D4 (cyan, session running)
- Click opens/closes the floating overlay

---

## Surface 4: Full Window Dashboard

```
┌──────────┬──────────────────────────────┬──────────────────┐
│          │  Nicolas                     │  Search...       │
│  Home    │  Level 1 · Apprentice        │                  │
│          │  ████░░░░░░░░  24 XP         │  Active Quest    │
│  Log     │                              │  □ Build proto   │
│          │  [silhouette figure]         │                  │
│  Quests  │                              │  Titles          │
│          │  Willpower    4              │  ▓▓▓░  Builder   │
│  Habits  │  Discipline   2              │  ▓░░░  Focused   │
│          │  Rigor        1              │                  │
│  Skills  │                              │  Today           │
│          │  Habits                      │  3h 20m          │
│  Journal │  [line chart, minimal]       │  180 XP earned   │
│          │                              │  Rank #47        │
│  Mentor  │                              │                  │
└──────────┴──────────────────────────────┴──────────────────┘
```

**Sidebar (left, 200px):**
- Background: #000
- Nav items: Home, Log, Quests, Habits, Skills, Journal, Mentor
- Active item: #fff, rest: #555
- Promethee ⋮⋮ mark at top, 24px

**Main panel (center):**
- Background: #0a0a0a
- User name: 22px, #fff, Inter Light
- Level + tier: 13px, #666
- XP bar: dots, orange-filled for earned
- Character figure: placeholder silhouette SVG (Real v1 = anatomy model)
- Skills: plain text list, name left + number right, #ccc / #fff
- Habits: minimal line chart, no axes, #333 grid

**Right panel (240px):**
- Background: #0a0a0a, left border: 1px solid #1a1a1a
- Search: glass input, 14px radius
- Quest checklist: checkboxes, 13px #ccc
- Titles/achievements: label + progress bar (2px height, #333 track, #FF6B35 fill)
- Today summary: hours worked, XP, rank — plain numbers, no charts

---

## What is NOT in the prototype

- AI Mentor chat (static mock only)
- Cinematic session-start screen
- Anatomy model (silhouette placeholder)
- Passive window tracking
- Hero's journey onboarding
- Skill tree interactions
- Memories / photo cards

All deferred to Real v1.

---

## Component Hierarchy

```
App
├── MenubarIcon
├── FloatingOverlay
│   ├── IdleBar (Mentor CTA + Start session)
│   └── ActiveSession
│       ├── LevelPill (top center)
│       ├── TimerCard (bottom left)
│       └── MentorMessage (bottom left, conditional)
└── FullWindow
    ├── Sidebar
    └── MainLayout
        ├── CharacterPanel (center)
        └── RightPanel
```

---

## Review Status
- UI patterns extracted from Nicolas's designs: DONE
- Spacing system: LOCKED
- Color system: LOCKED
- All surfaces specced: DONE
- Language: English only
- Ready to implement: YES
