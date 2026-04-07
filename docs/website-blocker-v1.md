# Website Blocker V1

Status: investigated on 2026-04-07, not built

## Decision

Promethee should ship a **macOS-only, session-scoped website blocker** as V1.

The right V1 is:

- **system-wide hostname blocking**
- **enabled only during an active focus session**
- **implemented with a native macOS Network Extension content filter**
- **controlled by the Electron app, but not implemented purely in Electron**

This is the smallest version that still feels like Promethee and not like a weak browser toy.

## Why this belongs in Promethee

This is already in the product direction. In [docs/cofounder/02-product.md](./cofounder/02-product.md), the core loop explicitly includes an **optional site blocker** as part of Focus + Silent XP.

The blocker also fits Promethee's real advantage:

- sessions already exist
- the overlay already exists
- passive tracking already exists
- Memory already turns behavior into identity

That means a blocker is not just "stop distractions." It becomes:

- session protection
- behavior evidence
- mentor context
- future Memory insight

Example:

> "You tried to open X 5 times during a 90-minute deep work block. Most attempts happened in the first 12 minutes."

That is very on-brand.

## What V1 should do

V1 scope:

- macOS only
- websites only, not full app blocking
- block by hostname / domain suffix, not full URL path
- only active while a Promethee focus session is running
- user picks a short list of blocked domains
- defaults ship with a small preset:
  - `x.com`
  - `twitter.com`
  - `instagram.com`
  - `youtube.com`
  - `reddit.com`
  - `tiktok.com`
- Promethee logs block attempts locally with:
  - domain
  - timestamp
  - active session id

V1 non-goals:

- Windows support
- mobile support
- full URL / regex rules
- category lists from third-party vendors
- parental controls
- hard app blocking
- remote policy sync
- bypass timers / admin override flows

## What blocked should mean

If a session is active and the user opens a blocked domain in Safari, Chrome, Arc, Firefox, or a webview-backed app:

- the network request is denied before the page loads
- Promethee logs the attempt
- the overlay can show a subtle interruption signal
- the session continues

Important product detail:

- do **not** make V1 punitive
- do **not** end the session automatically
- do **not** shame the user

This is a guardrail, not a punishment system.

## Recommended technical path

### Use a Network Extension content filter

Use a native macOS content filter built around `NEFilterDataProvider`.

Why:

- Apple explicitly says packet filter (`pf`) is **not API** and products should move to Network Extension.
- `NEFilterDataProvider` is meant to pass or block network flows.
- It works at the system networking layer, not only inside one browser.
- For WebKit-originated browser flows, Apple can show a dedicated block page.

This is the correct supported Apple path for a distributed macOS product.

### Do not use `pf`

Do not build V1 around `pfctl`, `/etc/pf.conf`, or any Packet Filter scripting.

Apple's own guidance in TN3165 is clear: Packet Filter is not supported API for distributed software, and content filters should use Network Extension instead.

### Do not make the V1 a browser extension

A browser extension is the fastest demo, but the wrong product:

- browser-specific
- weak to bypass
- doesn't cover Arc + Chrome + Safari + Firefox cleanly with one implementation
- doesn't feel like native desktop focus

It is fine for a throwaway experiment. It is not the right Promethee V1.

### Do not use the new URL Filter API for V1

Apple introduced a new URL-based filter path in **iOS and macOS 26**. It is powerful, but it is not the right first version here.

Reasons:

- it is newer and operationally riskier
- it adds extra infrastructure concepts, including a PIR/OHTTP setup for distribution-signed builds
- Apple's WWDC25 guidance frames it as a full URL filtering system, which is overkill for Promethee's first blocker
- Promethee does not need path-level precision to block `x.com`, `reddit.com`, or `youtube.com`

For Promethee V1, hostname-level blocking is enough.

## Why hostname blocking is good enough

For the sites Promethee cares about first, host blocking already captures the job:

- `x.com`
- `twitter.com`
- `instagram.com`
- `reddit.com`
- `youtube.com`

This is not a parental-control product trying to allow `youtube.com/course` while blocking `youtube.com/shorts`.

The user job is simpler:

> "When I am in a focus session, do not let me drift into scroll apps."

Hostname blocking solves that.

## Revised V1 architecture (eng review 2026-04-07)

The original plan called for `NEFilterDataProvider` (Network Extension). After eng review, V1 uses a simpler approach: **`/etc/hosts` + privileged launchd helper**. This works today without an Apple Developer account, requires no Xcode project, and the JS API is identical — so migrating to `NEFilterDataProvider` later is a helper swap, not a rewrite.

### Architecture diagram

```
  ┌─────────────────────────────────────────┐
  │  Electron App (Promethee)               │
  │                                         │
  │  src/main/blocker.js                    │
  │    activate(sessionId, domains[])       │
  │    deactivate()                         │
  │    cleanupOnStartup()                   │
  │                                         │
  │  src/main/index.js                      │
  │    session:start → blocker.activate()  │
  │    session:end   → blocker.deactivate()│
  │    app:ready     → blocker.cleanup()   │
  └──────────────┬──────────────────────────┘
                 │ Unix socket
                 │ /var/run/promethee-blocker.sock
                 │ JSON: {cmd, domains}
  ┌──────────────▼──────────────────────────┐
  │  PrometheeBlockerHelper (privileged)    │
  │  Runs as root via launchd               │
  │  Installed once at first setup          │
  │                                         │
  │  activate: write tagged block to        │
  │    /etc/hosts between markers           │
  │    run: dscacheutil -flushcache         │
  │                                         │
  │  deactivate: remove marker block        │
  │    run: dscacheutil -flushcache         │
  └──────────────┬──────────────────────────┘
                 │
  ┌──────────────▼──────────────────────────┐
  │  /etc/hosts                             │
  │  # BEGIN PROMETHEE BLOCKER              │
  │  0.0.0.0 x.com                          │
  │  0.0.0.0 twitter.com                   │
  │  # END PROMETHEE BLOCKER               │
  └─────────────────────────────────────────┘

  SQLite (local, no Supabase sync):
    blocked_domains: user's list, enabled flag, position
    blocker_events:  schema only in V1 (no writes)
```

### /etc/hosts tagging strategy

All Promethee entries must be wrapped in marker comments so cleanup is surgical and never touches the user's existing hosts file:

```
# BEGIN PROMETHEE BLOCKER — do not edit
0.0.0.0 x.com
0.0.0.0 twitter.com
0.0.0.0 instagram.com
# END PROMETHEE BLOCKER
```

The helper always replaces the entire block between markers atomically. On startup, `cleanupOnStartup()` scans for these markers and removes them if no active session exists (crash recovery).

### Startup cleanup (crash recovery)

If Electron crashes mid-session, `/etc/hosts` entries remain until the next launch. On every app start, before any window is shown:

1. Check if a Promethee marker block exists in `/etc/hosts`
2. Check if there is an active session in SQLite
3. If no active session → remove the marker block (helper call)
4. If active session → leave as-is (resume flow handles it)

### IPC: Unix socket

Electron talks to the helper via a Unix domain socket at `/var/run/promethee-blocker.sock`. Simple JSON protocol:

```json
// activate
{"cmd": "activate", "domains": ["x.com", "twitter.com"]}
// deactivate
{"cmd": "deactivate"}
// response
{"ok": true}
{"ok": false, "error": "..."}
```

### Failure handling (critical)

`blocker.activate()` failure must **never** silently fail. Rules:

- If the helper is not installed → session still starts, overlay shows `Blocker not set up`
- If the helper socket times out (crashed) → session still starts, overlay shows `Blocker unavailable`
- If `dscacheutil` fails → log warn, not fatal (DNS TTL will expire naturally)

The session lifecycle is never blocked on the blocker. It is a guardrail, not a hard dependency.

### DNS TTL note

Blocking is not instant. If the user has `x.com` cached in their browser or system DNS resolver, it stays accessible for up to the TTL (usually 60-300s) even after the hosts entry is written. `dscacheutil -flushcache` handles the system cache. Browser DNS caches are unaffected. Document this in the Settings UI: "Websites may take a few seconds to block after session starts."

### Electron responsibilities

The Electron app remains the product shell.

It owns:

- session lifecycle
- blocker preferences UI
- storing blocked domains in SQLite
- turning blocker on when a session starts
- turning blocker off when a session ends
- showing blocker state in overlay (active / unavailable / not set up)

Planned JS-side touch points:

- `src/main/index.js` — activate / deactivate blocker on session start/end, cleanup on startup
- `src/main/preload.js` — expose blocker APIs to renderer
- `src/main/db.js` — add `blocked_domains` + `blocker_events` tables
- `src/renderer/components/FullWindow/SettingsTab.tsx` — blocker toggle + domain list
- `src/renderer/components/FloatingOverlay/*` — blocker state pill during active session

New JS module:

- `src/main/blocker.js` — all blocker logic, helper IPC, cleanup

### Native helper responsibilities

The native side owns actual enforcement.

Recommended layout:

- `native/macos/PrometheeBlockerHelper/` — single privileged process (Swift or Go), Unix socket server, reads/writes /etc/hosts

**Not** two separate targets. The original two-target design (Host + Filter) was for NEFilterDataProvider. With /etc/hosts, one helper does everything.

### Why not NEFilterDataProvider for V1

This is deferred to V2. See the original research below. The migration path is clean: `blocker.js` API stays identical, the helper implementation changes, the JS never knows the difference.

## Original proposed architecture (NEFilterDataProvider — V2 target)

Promethee today is an Electron Forge app with no native macOS targets yet. See [forge.config.js](../forge.config.js).

So V2 needs **two layers**:

1. **Electron app**
2. **native macOS Network Extension**

### Native macOS responsibilities (V2)

The native side owns actual enforcement.

Recommended layout:

- `native/macos/PrometheeBlockerHost/`
- `native/macos/PrometheeBlockerFilter/`

#### Host app / manager layer

This native layer does:

- request activation of the system extension
- own the Network Extension preferences
- read shared blocker state from an App Group container
- expose a minimal IPC bridge back to Electron

#### Filter extension layer

This native extension does:

- receive new network flows
- inspect hostname metadata
- match against the active blocklist
- return allow or drop
- append a minimal event record to shared storage

### Shared data path

Use an **App Group** shared container between Promethee and the native blocker.

The App Group stores:

- effective active blocklist
- blocker enabled/disabled state
- latest block attempt events

This avoids trying to make the extension talk directly to the Electron runtime.

## Data model for V1

Add local tables like:

### `blocked_domains`

- `id`
- `domain` (unique constraint — no duplicates)
- `enabled` (INTEGER 0/1)
- `preset` (INTEGER 0/1 — marks default presets)
- `position` (INTEGER — for user-defined ordering)
- `created_at`
- `updated_at`

### `blocker_events`

- `id`
- `session_id`
- `domain`
- `blocked_at`
- `source`

**V1 note:** The `blocker_events` table is created but not written to in V1. With `/etc/hosts` blocking, DNS requests are dropped silently — there is no callback to log individual attempts. The table schema is created now so V1.5 (DNS proxy or NEFilterDataProvider) can populate it without a migration.

`source` values (V1.5+):

- `hosts_proxy` — local DNS proxy detects the attempt
- `network_filter` — NEFilterDataProvider (V2)

Do not store full URLs in V1.
Do not store query params in V1.
Hostname is enough and cleaner for privacy.

## User flow

### First-time setup

1. User turns on Website Blocker in Settings.
2. Promethee explains that macOS will ask for approval for a network blocker.
3. Promethee activates the bundled system extension.
4. User approves it in the macOS flow.
5. Promethee confirms blocker readiness.

### Normal use

1. User starts a focus session.
2. Promethee enables blocker state for that session.
3. User opens `reddit.com`.
4. Request is blocked.
5. Promethee records the attempt.
6. Overlay can show a minimal notice like:
   - `Blocked reddit.com during Focus`
7. Session ends.
8. Promethee disables the blocker.

## UX constraints to design around

This is where the project gets real.

### Constraint 1: setup friction

Network Extension / system extension setup on macOS is not frictionless.

Users will need:

- a signed build
- a properly packaged native extension
- system approval during activation

This means blocker V1 and "unsigned beta DMG" do not mix well.

### Constraint 2: distribution quality suddenly matters

Promethee today still documents unsigned / non-notarized macOS distribution in [README.md](../README.md) and [BUILD.md](../BUILD.md).

A blocker V1 changes the bar.

If blocker is part of the product, Promethee should treat these as prerequisites:

- Apple Developer account
- signing
- notarization
- stable install path

Without that, the blocker setup will feel sketchy and users will bounce.

### Constraint 3: browser UX is uneven

Apple documents special remediation / block-page behavior for **WebKit** browser flows.

That means:

- Safari can have a nicer block page
- other browsers may show a more generic failure surface

So Promethee should not depend on fancy in-browser messaging.

The reliable UX is:

- block at network layer
- reflect the block in Promethee overlay / dashboard

## Effort estimate

### Prototype

Roughly **1-2 weeks** for a technical prototype if done narrowly:

- one preset list
- macOS only
- native filter target
- session on/off hook
- local logging

### Shippable beta

More like **2-4 weeks** end to end.

The hard part is not the `if host matches rule, drop flow` logic.

The hard parts are:

- native target setup
- Electron + native packaging
- code signing
- notarization
- activation UX
- debugging on real machines

That is the whole game.

## Biggest risks

### 1. Packaging complexity

Promethee is currently an Electron Forge app, not an Xcode-first macOS app.

Adding a native Network Extension means introducing a parallel native build artifact and bundling it correctly into the shipped app.

### 2. Activation friction

System extension approval is a real product moment.

If this step is confusing, users will think the app is broken.

### 3. False sense of completeness

Website blocking is not the same as app blocking.

If the product copy says "Promethee blocks distractions everywhere," but only websites are blocked, people will immediately test Slack, Telegram, and Discord and call it fake.

Be exact in the UI:

- `Block websites during Focus`

Not:

- `Block distractions`

## What should come after V1

### V1.5

- smarter presets
- session-complete summary:
  - `3 attempts blocked`
- Memory integration:
  - blocked domains by time-of-day
  - "weakest first 10 minutes" pattern

### V2

- soft app blocker
  - detect blocked app in foreground
  - bring Promethee back to front
  - show interruption state
- macOS 26 URL filter research for path-level precision
- per-room / per-goal block presets

### V3

- real app blocking
- Windows support

## Recommended build order

If Promethee decides to build this:

1. Finish signing + notarization groundwork.
2. Add native macOS blocker targets.
3. Ship internal-only blocker prototype on macOS.
4. Add Settings UI and session hooks.
5. Add event logging.
6. Add Memory / Mentor usage of blocker events.

Do not reverse that order.

## Final recommendation

Build the blocker.

But build the **real first slice**, not the fake easy one.

That means:

- macOS only
- websites only
- session-scoped
- hostname-level
- native Network Extension content filter

That is small enough to ship, strong enough to matter, and aligned with what Promethee is trying to become.

## Sources

- Apple Developer, `NEFilterDataProvider`:
  https://developer.apple.com/documentation/networkextension/nefilterdataprovider
- Apple Developer, `System Extensions`:
  https://developer.apple.com/documentation/systemextensions
- Apple Developer, `Installing System Extensions and Drivers`:
  https://developer.apple.com/documentation/systemextensions/installing-system-extensions-and-drivers/
- Apple Developer, `OSSystemExtensionRequest.activationRequest`:
  https://developer.apple.com/documentation/systemextensions/ossystemextensionrequest/activationrequest%28forextensionwithidentifier%3Aqueue%3A%29
- Apple Developer, `Configuring App Groups`:
  https://developer.apple.com/documentation/xcode/configuring-app-groups
- Apple Developer, `TN3165: Packet Filter is not API`:
  https://developer.apple.com/documentation/technotes/tn3165-packet-filter-is-not-api
- Apple Developer, WWDC25 `Filter and tunnel network traffic with NetworkExtension`:
  https://developer.apple.com/videos/play/wwdc2025/234/
