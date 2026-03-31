# Promethee UI Patterns
*Extracted from Nicolas's actual designs — 2026-03-31*

## Color
- Near-zero color system. Dark gray/black everywhere.
- ONE orange/amber accent: Mentor button CTA only (#FF6B35 gradient)
- Cyan only for active timer ring
- Everything else: dark glass + white/muted text
- No gradients except the single orange CTA button

## Overlays (floating surfaces)
- Frosted glass, very rounded corners (24px+)
- Float OVER real work — user sees their app behind
- Wide pill for the main bar (~600px+), not narrow
- Six-dot Promethee mark (⋮⋮) always visible as handle/anchor

## The floating bar (idle state)
- Left: orange gradient pill button "Mentor" with Promethee icon
- Center: "○ Lancer une session" — circle + text, minimal
- Right: user avatar + grid icon
- NO timer when idle — just the CTA

## The floating bar (active session)
- Level pill top center: "Niveau 19 — Tier S" with XP progress dots
- Circular timer bottom left (cyan progress ring, large)
- Quest cards bottom left (floating, checkable)
- Mentor chat bottom left (frosted glass, streaming)
- ALL floating over user's actual work

## Mentor chat
- Large frosted glass card, full-width-ish
- Large text (18px+), no avatar, just words
- User message right-aligned, AI response left-aligned
- Mic input at bottom
- This is a person talking to you, not a bot

## Session start screen
- Cinematic full-screen: person silhouette, warm amber/orange background
- Feels like launching a quest, not starting a timer
- Level + tier pill top center
- Timer widget bottom left (circular, stopwatch/timer mode)
- Quest list right side (checkboxes)
- Emotional, not functional

## Full window dashboard
- Pure black left sidebar, no borders, icon + label nav
- Nav: Home, Rapports, Quêtes, Habitudes, Arbre de compétences, Pensées, Mentor
- Center: CHARACTER identity — anatomical body model, level, tier, skills (Volonté, Discipline, Rigueur)
- Right panel: search, Quêtes principales, Titres (achievement bars), Memories (photo cards)
- NOT a productivity dashboard — it's an RPG character sheet

## Typography
- Large, readable
- Muted low-contrast labels (#666 ish)
- High contrast for key data only
- No monospace for UI — clean sans-serif throughout

## What's NOT in Nicolas's design
- No session timeline (that's Rize — not Promethee)
- No XP bar as primary UI element
- No leaderboard as a table
- No dark navy — it's near-black (#0a0a0a, #111, #1c1c1c)

## The soul of the product
The UI is an RPG character sheet that happens to have a timer.
Identity first, productivity second.
The Mentor is the emotional core — not the timer, not the leaderboard.
