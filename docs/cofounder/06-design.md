# 06 — Design & DA

> 🎨 **TL;DR** — Retro-futurist, organic, dense. Ocre/rose gold and black. Translucent overlay — liquid glass. The product must feel like entering a distinct world. The UI is a HUD, not a dashboard.
> 

### Visual Direction

**Mood**
Retro-futurist organic. Colors: ocre / rose gold + black. Sensation: distinct, mysterious, elegant. Technological grandeur — calm intensity. Like launching Jarvis, not opening a to-do list.

![image.png](06%20%E2%80%94%20Design%20&%20DA/image.png)

**UI Language**
Translucent / liquid glass overlay on the OS. Minimal chrome. Spatial depth. Elements float above the user's existing workspace. Dark, quiet, confident. Never busy, never decorative.

![Ambiance & UI.png](06%20%E2%80%94%20Design%20&%20DA/Ambiance__UI.png)

![UI.png](06%20%E2%80%94%20Design%20&%20DA/UI.png)

### References

**Vibe & Ambiance**
Anduril (UI + animation) · Neuralink · Palantir · Apple (clarity) · Dune (world-feeling) · Alien Isolation (atmospheric tension)

![image.png](06%20%E2%80%94%20Design%20&%20DA/image%201.png)

![image.png](06%20%E2%80%94%20Design%20&%20DA/image%202.png)

![image.png](06%20%E2%80%94%20Design%20&%20DA/image%203.png)

**Product / UX**
Cluely (transparent overlay — reverse-engineer) · Raycast (speed + hotkeys) · Cursor (OS-layer feel) · Linear (design density) · Battlefield HUD

**Narrative**
Obsidian (thought graph) · Strava (progression sharing) · Guild Wars 2 (skill builds) · Campbell's Hero's Journey (narrative arc)

---

### The World Vision — Why This Must Feel Like a Game

Promethee is not a smart Pomodoro. The graveyard of this category is full of products with the right mechanics and no soul — Focusmate, Forest, Pomofocus. They have focus timers. Nobody feels proud to use them. Nobody posts about them. There's no identity in it.

The difference between Duolingo and a flashcard app is not the learning mechanics. It's the feeling of being inside the product. Duolingo wins because it has a character, a world, stakes that feel real. That's what Promethee has to be.

**The Iron Man / HUD Vision**

When a user starts a focus session, they should feel like they're suiting up.

The overlay is already translucent glass floating above their real desktop. That's the right primitive — it's halfway to a HUD. The next step: lean into it. Elements that feel like a tactical interface overlaid on reality. Subtle scan lines, ambient glow that intensifies as session depth increases, a visual sense that something is *tracking* you — in the good way. Not surveillance. Command.

The session state should communicate through atmosphere, not just numbers. Early in a session: calm, quiet, ambient. 45 minutes in: the glow deepens, the pulse is slower, the UI recedes further. Session end: a moment of release — the screen breathes, XP ticks up, Prométhée speaks.

**Background Music / Soundscape**

This is underestimated. Lofi Girl built a massive brand on ambient sound + a visual world. Study With Me channels get millions of views. People want an ambient environment for deep work — they're already building it manually with YouTube.

Promethee can own this. A soundscape that responds to session state:
- Pre-session / idle: silence or barely-there ambient texture
- Session start: a subtle audio cue — like a system activating
- Active session: low ambient score, builds imperceptibly over time
- Flow state (45+ min): the music deepens, becomes more cinematic
- Session end: a distinct resolution — not a notification sound, a moment

Users will describe this to their friends. "The music changes when you're in the zone." That's a word-of-mouth trigger built into the UX.

**Why This Has to Be in V1 Bones, Not V3 Polish**

You can add features after launch. You can't retrofit soul. Teams that try to add visual identity after PMF get it wrong because the product has accumulated interaction patterns that fight the new direction.

The retro-futurist direction (ocre/rose gold, liquid glass, atmospheric tension) needs to be a V1 architectural decision — not a skin applied later. The overlay's translucency, the amber glow on active states, the Instrument Serif for hero moments — these aren't decoration. They're the world. Every component built without this in mind is technical debt against the feeling.

**The Question for Paris**

At what point in the roadmap does the visual/audio world land? If the answer is "V3 after we validate retention" — that's probably too late. The *feel* of the product is what drives the word-of-mouth that gives you the retention data in the first place. The mechanics retain. The world makes people evangelize.