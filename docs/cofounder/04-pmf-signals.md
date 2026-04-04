# 04 — PMF & Signals

> 📊 **TL;DR** — 88.9% loyalty rate. W4 retention at 45%+ — meaning 45% of buyers still show up to Discord study rooms at week 4. That's ritual, not casual usage. The retention floor is 45% with maximum friction. The ceiling is unknown.
> 

### What the Retention Actually Means

The 45% W4 number is measured on the most friction-heavy action in the product: open Discord → navigate to server → find a study room → click to join → sit there passively to get tracked. Despite this, nearly half are still doing it at week 4. The native app eliminates every one of those steps. Discord becomes optional — community if you want it, not infrastructure you're forced through.

### Retention Metrics (n=722 measurable users)

| Metric | Value | Context |
| --- | --- | --- |
| Loyalty Rate | 88.9% | returned on multiple separate days |
| Week 1 Retention | 65% | ~2x market average |
| Week 4 Retention | 45%+ | market avg: 20–25% |
| Total Sessions | 42k+ | since April 2025 |
| Avg Sessions / User | 17 | organic only, no marketing push |
| Peak Session Starts | 3,100/h | 12:00–13:00 daily |

### Validation History

**Phase 1 — Template only (no bot, no AI)**
users paid €59.90 for a Notion template: centralised productivity tools + visual gamification. No Discord required. Pure demand for centralisation + visible progression.

**Phase 2 — Template + Discord bot (current)**
2,500 users. Added hour tracking via Discord bot + study rooms + community. Retention increased. Discord friction excluded a significant portion of potential users.

### User Research — TypeForm (n=93)

- **68.8% want an AI mentor who knows their objectives and proactively coaches them *(personalise 66.3%, remind progress 62%, organise 54.3%)***
- **60.2% want a skill tree that evolves automatically from real actions *(current build is too manual)***
- **56% choose Prométhée for unified ecosystem — centralisation is the primary value**
- **45.6% cite UX complexity and Discord friction as primary pain point *("too many screens", "I lose time", "make it simpler")***

### Next Step — Power User Analysis

**The question to answer before V1 ships:** among 2,500 paying users, who has the most sessions, longest streaks, best W4 retention — and what do they do differently in week 1?

Method: extract from Discord bot the top 50 users by session count, streak length, and average session duration. Cross-reference the three lists. Call 5 overlapping names for 20 minutes. Three questions only:

1. What do you do systematically every session?
2. What made you skip when you skipped?
3. If Prométhée disappeared tomorrow, what would you miss most?

### Validated / Not Yet Validated

**Validated**

- ✓ Gamification creates ritual and habit
- ✓ Paying despite heavy Discord friction
- ✓ Centralisation = primary perceived value
- ✓ Community drives accountability
- ✓ Hour tracking generates engagement

**Not Yet Validated**

- Native app retention vs Discord-gated MVP
- Retention delta from removing Discord friction
- AI mentor engagement at V1 (1 message/day)
- 90-day reveal as retention and WOM event
- HUD overlay as retention driver vs aesthetic

### Two Power User Archetypes — Identified from Data

**Archetype A — Daily ritual (ex: Adam, 2,989 sessions, 0.66h avg)**
Shows up every day for shorter sessions. The value is the streak and the habit. Primary trigger: opening Prométhée must be instant and immediately rewarding. Risk: if the streak breaks, churn.

**Archetype B — Deep work marathon (ex: nolwenn_bis, 415 sessions, 5.92h avg)**
Fewer sessions but 4–8 hours each. The value is measurement and proof of deep work. Primary trigger: Prométhée must make long sessions feel different — not just "more of the same."

**V1 implication:** XP mechanics must reward both. Short sessions get streak reinforcement. Long sessions get a depth multiplier or distinct recognition. One mechanic that flattens both profiles is a mistake.