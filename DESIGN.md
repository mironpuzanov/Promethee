# Design System — Promethee

## Product Context
- **What this is:** Gamified productivity desktop app — focus timer, XP, leaderboard, AI mentor
- **Who it's for:** 18-30 year olds who want to become high performers. Already in the community. Not new to productivity concepts.
- **Space/industry:** Gamified productivity, social accountability, desktop utilities
- **Project type:** Electron desktop app — two surfaces: floating overlay + full window

## Aesthetic Direction
- **Direction:** Cinematic Dark — matte warm near-black, single fire accent, premium minimal
- **Decoration level:** Intentional — amber glow on active states only, no decorative patterns
- **Mood:** The opening of a prestige film. Prometheus stole fire from the gods. This is a transformation system, not a productivity tool. Serious, weighted, mythic.
- **NOT:** A gaming app. No rainbow gradients, no bouncy animations, no cartoon gamification.

## Two Surfaces — Different Rules

### Overlay (always on top, floating)
- Always semi-transparent — `backdrop-filter: blur(20px)` with `rgba(12, 10, 9, 0.65)` background
- Never fully opaque — it lives on top of the user's work, must not feel intrusive
- Compact: timer + task + XP + presence. Nothing else.
- Electron `setVibrancy` or CSS backdrop-blur for the glass effect on macOS

### Full Window
- Solid dark surfaces — `#0C0A09` background, `rgba(20, 17, 14, 0.95)` cards
- Full leaderboard, community, stats, settings
- Reuse existing shadcn components — do not rebuild from scratch
- Sidebar nav: icon-only, left rail, dark

### Onboarding
- Hero journey framing — "Your quest begins", "Week 1 · The Awakening"
- Cinematic full-screen dark with subtle radial amber glow
- Font needs work — Instrument Serif direction is right but implementation TBD
- Do not change until hero journey design is locked with Nicolas in Paris

## Typography
- **Body/UI:** `Geist` — all interface text, labels, buttons, nav
  - Replace Inter. Geist is what Vercel built for developer tools — same precision, more personality.
- **Data/Timer:** `Geist Mono` with `font-variant-numeric: tabular-nums` — timer, XP numbers, leaderboard ranks, hours
- **Display/Hero:** `Instrument Serif` — hero moments only (level up, onboarding, quest complete). NOT for everyday UI.
- **Loading:** Google Fonts CDN for Geist + Geist Mono + Instrument Serif
- **Scale:**
  - xs: 11px / sm: 12px / base: 14px / md: 16px / lg: 20px / xl: 24px / 2xl: 32px / hero: 48px+

## Color
- **Approach:** Restrained — one accent, used sparingly, color is rare and meaningful
- **Background:** `#0C0A09` (warm near-black — tiny red/brown undertone makes amber feel intentional)
- **Surface:** `rgba(20, 17, 14, 0.90)` cards / `rgba(20, 17, 14, 0.65)` overlay
- **Sidebar:** `#070605`
- **Text primary:** `#F2EDE8` (warm white — not pure #fff, slightly cream)
- **Text secondary:** `#A09890`
- **Text muted:** `#5C5450`
- **Accent fire:** `#E8922A` (amber — the single accent. Drop cyan entirely.)
- **Accent glow:** `rgba(232, 146, 42, 0.15)` (halos, active state backgrounds)
- **Accent glow strong:** `rgba(232, 146, 42, 0.25)` (rank #1, CTA focus)
- **Border:** `rgba(255, 255, 255, 0.06)`
- **Border accent:** `rgba(232, 146, 42, 0.30)` (active session border, selected state)
- **Success:** `#4ADE80`
- **Destructive:** `#EF4444`

### Token migration (App.css)
Current tokens to update:
- `--accent-orange: #FF6B35` → `#E8922A`
- Remove `--accent-cyan: #06B6D4` (replaced by amber-only system)
- `--text-primary: #ffffff` → `#F2EDE8`
- `--text-secondary: #cccccc` → `#A09890`
- `--text-muted: #666666` → `#5C5450`
- `--bg: #0a0a0a` → `#0C0A09`
- `--sidebar-bg: #000000` → `#070605`
- `--ring: #06B6D4` → `#E8922A`
- `--surface` overlay variant: `rgba(12, 10, 9, 0.65)` with backdrop-blur

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (desktop app stared at for hours — not cramped)
- **Scale:** 2(2px) 4(4px) 8(8px) 12(12px) 16(16px) 24(24px) 32(32px) 48(48px) 64(64px)
- **Border radius:** sm(6px) md(10px) lg(14px) overlay(16px) full(9999px)

## Layout
- **Full window:** Fixed sidebar (48px wide, icon-only) + main content area + optional right panel
- **Max content width:** 960px centered in main area
- **Leaderboard:** Table layout — rank / avatar+name / hours / XP. Amber glow on #1.
- **Overlay:** Fixed position, top-right or user-draggable. Width: 280px compact / 320px expanded.
- **Grid:** 8-column in main content area

## Motion
- **Approach:** Intentional — nothing decorative, everything communicates state
- **Timer pulse:** Subtle amber glow breath on active session (2s ease-in-out loop, opacity 0.4→0.8)
- **XP increment:** Number ticks up on session end (counter animation, 600ms)
- **Session complete:** Brief scale(1→1.02→1) + fade on XP card (300ms)
- **Overlay appear/disappear:** opacity + translateY(8px), 200ms ease-out
- **Never:** Bouncy spring physics. Spinning loaders. Slide-in panels that push content.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(80ms) short(150ms) medium(250ms) long(400ms)

## Component Rules
- **Reuse existing shadcn components** — do not rebuild Button, Input, Card, etc.
- **Checkbox accent:** `#E8922A` (currently hardcoded purple `#7c3aed` — fix this)
- **Active/focus ring:** `#E8922A` (replace cyan ring)
- **Leaderboard row #1:** amber left border `3px solid #E8922A` + subtle `rgba(232,146,42,0.08)` row bg
- **XP display:** always Geist Mono, amber color
- **Timer display:** always Geist Mono, large, warm white

## What to NOT do
- No cyan anywhere (existing `#06B6D4` is deprecated)
- No purple anywhere (existing `#7c3aed` checkbox was wrong)
- No Inter as primary font (replace with Geist)
- No fully opaque overlay — always glass
- No cartoon/game UI patterns in the overlay or full window

## The World Vision — Atmosphere Over Interface

Promethee is not a smart Pomodoro. It's a world you enter.

The graveyard of this category is full of products with correct mechanics and no soul. The
difference between Duolingo and a flashcard app isn't the learning engine — it's the feeling
of being inside the product. Promethee needs that feeling.

### The HUD / Iron Man Principle

The overlay is already translucent glass floating above the user's real desktop. That's the
right primitive — it's halfway to a tactical HUD overlaid on reality. The design direction
leans into this, not away from it.

A focus session is a ritual. Starting one should feel like suiting up:
- The overlay activates: a subtle system-boot feel, not a button click
- Session running: the interface recedes, glows deepen, ambient pulse slows — the product
  communicates "you're in the zone" through atmosphere, not a notification
- Flow state (45+ min): UI becomes more minimal, glow intensifies, music deepens
- Session end: a moment of release — XP ticks up, Prométhée speaks, screen breathes

Never just a timer. Always a state change the user can feel.

### Soundscape (planned feature, not yet built)

Background music that responds to session state is a core product feature, not decoration:
- **Idle/pre-session:** silence or near-silence
- **Session start:** a subtle activation audio cue — system coming online
- **Active session:** low ambient score, barely audible, builds imperceptibly
- **Flow state (45+ min):** music deepens, more cinematic
- **Session end:** a distinct resolution moment — not a notification, a reward

Reference: Lofi Girl, Study With Me channels — users already build this manually with YouTube.
Promethee should own it natively. "The music changes when you're in the zone" is a
word-of-mouth trigger built into the UX.

Sound should follow the same restrained principle as visuals: nothing decorative, everything
communicates state. No game sound effects, no achievement jingles. Atmospheric, cinematic,
purposeful.

### Why This Must Be V1 Architecture, Not V3 Polish

Visual identity cannot be retrofitted. The amber glow on active states, the glass overlay,
the Instrument Serif for hero moments — these are the world. Components built without this
in mind are technical debt against the feeling. Every new surface should ask: does this feel
like a HUD, or does it feel like a dashboard?

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-02 | Single amber accent, drop cyan | One accent = clarity. Fire = Prometheus mythology baked into color. |
| 2026-04-02 | Geist replaces Inter | Inter is overused. Geist has same precision, more personality for a "developer-grade" product. |
| 2026-04-02 | Overlay always semi-transparent | Always-on-top widget must not block user's work. Glass effect = present but not intrusive. |
| 2026-04-02 | Warm near-black (#0C0A09) not pure black | Tiny warm undertone makes amber accent feel intentional, not dropped on a void. |
| 2026-04-02 | Onboarding font TBD | Instrument Serif direction approved, specific implementation deferred to post-Paris. |
| 2026-04-02 | Full window reuses existing components | No rebuild — polish and retokenize existing shadcn components. |
