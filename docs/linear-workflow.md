# Linear Workflow

This is the single source of truth for how we track work, ship code, and close issues.
Claude references this file whenever touching Linear, git, or the release process.

---

## The Process (end to end)

```
Issue in Linear → branch → code → commit → close issue → release if ready
```

### 1. Pick an issue

All work starts from a Linear issue. If something isn't in Linear, create it first.

Issues live in the **Promethee-app** team at: https://linear.app/promethee-app

### 2. Branch

Use the branch name Linear generates — shown on every issue under "Git branch name":

```
yeamiron/pro-8-focus-session-doesnt-start-reliably-on-first-launch
```

```bash
git checkout -b yeamiron/pro-8-focus-session-doesnt-start-reliably-on-first-launch
```

### 3. Code + commit

Commit messages must reference the Linear issue ID so commits auto-link in Linear:

```bash
git commit -m "fix(focus): resolve initialization race condition on first launch

PRO-8"
```

The `PRO-8` at the end links the commit to the issue in Linear automatically.

### 4. Close the issue

When the fix is merged to main, mark the issue **Done** in Linear.
Claude should do this after merging — don't leave issues open after the code ships.

### 5. Release

After one or more issues are done, bump the version and ship:

```bash
# Edit package.json version, then:
rm -rf out && bash scripts/release.sh --notes "What changed"
```

See [release-flow.md](./release-flow.md) for the full release process.

---

## Issue priorities

| Priority | Meaning |
|----------|---------|
| Urgent | Blocks users, ship ASAP |
| High | Ship in the next release |
| Medium | Ship when convenient |
| Low | Nice to have |

---

## Issue statuses

| Status | Meaning |
|--------|---------|
| Backlog | Not started |
| In Progress | Being worked on |
| In Review | PR open or being reviewed |
| Done | Merged to main, not yet released |

Claude should update the status when starting work (`In Progress`) and when done (`Done`).

## Release milestones

Every issue that ships in a release must be attached to a milestone (e.g. `v1.1.5`).
This is the single source of truth for what's fixed but unreleased vs already shipped.

**Milestone lifecycle:**
- Create the milestone when the release version is decided (at version bump time)
- Attach all `Done` issues for that release to the milestone
- Milestone description = "Released." once the DMG is published

**Claude does this automatically** when bumping the version and closing issues.

Current milestones:
- `v1.1.4` — Released (PRO-6, PRO-12)
- `v1.1.5` — Released (PRO-8, PRO-13, PRO-17)

---

## Commit message format

```
type(scope): short description

PRO-<id>
```

Types: `fix`, `feat`, `refactor`, `style`, `chore`, `docs`

Examples:
```
fix(focus): resolve init race condition on first launch

PRO-8
```
```
feat(onboarding): sequential permissions flow with step-by-step UI

PRO-6
```
```
style(light-mode): full visual polish pass across all screens

PRO-5
```

---

## What goes in Linear

- Every bug found in testing
- Every feature or improvement
- Every design change
- Every release (as a comment or milestone)

If it takes more than 5 minutes to build, it gets a Linear issue.

---

## What Claude does automatically

When working on any task, Claude will:

1. **Check Linear** for the relevant issue before starting
2. **Update status to In Progress** when starting work
3. **Reference the issue ID** in every commit message
4. **Mark Done** after the fix is merged
5. **Never commit or push** without explicit instruction from Miron

---

## MCP setup

Linear is connected via MCP. Claude can read and write issues directly.

If Linear tools are unavailable, run:
```bash
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
```

Then restart Claude Code and authenticate when prompted.
