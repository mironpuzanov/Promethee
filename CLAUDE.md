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
