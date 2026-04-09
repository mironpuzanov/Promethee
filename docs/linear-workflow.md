# Linear Workflow

This is the single source of truth for how we track work, ship code, and close issues.
Claude references this file whenever touching Linear, git, or the release process.

---

## The Process (end to end)

```
Issue in Linear → In Progress → code → commit (with ID) → Ready for Release → release → Done + milestone
```

---

## 1. Every piece of work starts as a Linear issue

If it doesn't have an issue, create one first. No exceptions.

Issues live in the **Promethee-app** team: https://linear.app/promethee-app

---

## 2. Labels — always apply at least one

Labels are how you filter by type. Claude applies these automatically when creating or closing issues.

| Label | Use for |
|-------|---------|
| `Bug` | Something broken that used to work (or never worked) |
| `Crash / Blocker` | App crash or feature completely unusable — always Urgent priority |
| `UX` | Visual, interaction, or user flow issues |
| `Feature` | New functionality |
| `Improvement` | Enhancement to existing feature |
| `Technical Debt` | Internal code quality, tooling, infra |
| `Performance` | Speed, memory, startup time |

Multiple labels are fine. A transparent modal is both `Bug` and `UX`.

---

## 3. Priorities

| Priority | Meaning |
|----------|---------|
| Urgent | Blocks users or first-launch experience — ship ASAP |
| High | Ship in the next release |
| Medium | Ship when convenient |
| Low | Nice to have |

`Crash / Blocker` label → always Urgent.

---

## 4. Statuses

```
Backlog → In Progress → In Review → Ready for Release → Done
```

| Status | Meaning |
|--------|---------|
| Backlog | Not started |
| In Progress | Being worked on right now |
| In Review | Code written, being reviewed |
| Ready for Release | Merged to main, waiting for next release |
| Done | Shipped to users (released) |

**Claude updates status automatically:**
- Starting work → `In Progress`
- Code merged to main → `Ready for Release`
- Release cut → `Done`

---

## 5. Branches

Use the branch name Linear generates (shown on every issue):

```bash
git checkout -b yeamiron/pro-8-focus-session-doesnt-start-reliably-on-first-launch
```

---

## 6. Commits

Every commit must reference the Linear issue ID:

```
type(scope): short description

PRO-<id>
```

Types: `fix`, `feat`, `refactor`, `style`, `chore`, `docs`

Examples:
```
fix(session): resolve startup race condition on first launch

PRO-8
```
```
feat(onboarding): sequential permissions flow with step-by-step UI

PRO-6
```

---

## 7. Closing issues

When code is merged to main, Claude will:
1. Set status → `Ready for Release`
2. Add a GitHub commit link as an attachment on the issue
3. Update the issue description with root cause + fix summary

When a release is cut, Claude will:
1. Set status → `Done`
2. Attach all issues to the release milestone

---

## 8. Release milestones

Every issue that ships must be attached to a version milestone (e.g. `v1.1.5`).
This is the source of truth for what's in each release.

**Milestone lifecycle:**
1. Version bumped in `package.json` → create milestone `vX.X.X`
2. Attach all `Ready for Release` issues to it
3. Cut the release → move all to `Done`, update milestone description to "Released."

**View releases:** Open the project "Engineering | Desktop App" → switch to Milestones view.

Current milestones:
- `v1.1.4` — Released (PRO-6, PRO-12)
- `v1.1.5` — Released (PRO-8, PRO-13, PRO-17)
- `v1.1.6` — In progress (PRO-20)

---

## 9. What Claude does automatically

| Trigger | Claude does |
|---------|-------------|
| Starting work on an issue | Sets status → `In Progress` |
| Code merged to main | Sets status → `Ready for Release`, attaches commit link |
| Version bumped | Creates milestone, attaches all `Ready for Release` issues |
| Release cut | Moves issues → `Done`, updates milestone description |
| New issue created | Applies correct labels, sets priority |
| Never | Commits or pushes without explicit instruction from Miron |

---

## 10. MCP setup

Linear is connected via MCP. Claude reads and writes issues, labels, milestones, comments, and attachments directly.

If Linear tools are unavailable:
```bash
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```

Then restart Claude Code and authenticate when prompted.
