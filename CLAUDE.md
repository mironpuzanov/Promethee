# Claude Code — Safety Rules for This Project

## HARD LIMITS (never do these)
- Never run `rm -rf` on anything outside `/Users/mironpuzanov/Promethee/`
- Never modify files outside `/Users/mironpuzanov/Promethee/`
- Never run `sudo` or any command requiring elevated privileges
- Never delete the `.env` file
- Never push to GitHub without explicit instruction
- Never install global npm packages (`npm install -g`)
- Never modify system files, shell configs (.zshrc, .bashrc), or dotfiles
- Never run `killall`, `pkill`, or kill processes other than ones you started

## ALLOWED
- Create, edit, delete files inside `/Users/mironpuzanov/Promethee/`
- Run `npm install`, `npm start`, `npm test` inside the project
- Run `git add`, `git commit` inside the project
- Run `supabase` CLI commands scoped to this project
- Read any file on the system (read-only is fine)

## Build goal
Read BUILD.md and implement everything in it.
Work directory: /Users/mironpuzanov/Promethee/

## Issue tracking & workflow
Read docs/linear-workflow.md before starting any task.
All work must be tracked in Linear. Reference issue IDs in every commit message.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Product ideas, "what should we build", "what's next", brainstorming, strategy → invoke office-hours
- Bugs, errors, "why is this broken", crash, "not working" → invoke investigate
- Ship, commit and push, create PR, "let's push" → invoke ship
- QA, "test the app", "find bugs", "does this work" → invoke qa
- Code review, "check my diff", "review this" → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro, "how did this week go" → invoke retro
- Design system, brand, colors, tokens → invoke design-consultation
- Visual audit, "make it look better", UI polish → invoke design-review
- Architecture review, "review the plan", "eng review" → invoke plan-eng-review
- Save progress, checkpoint, "I'll continue later" → invoke checkpoint
- Codebase health, "is the code clean" → invoke health
- Something is slow, performance → invoke benchmark
