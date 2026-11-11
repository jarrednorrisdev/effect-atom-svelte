# Issue tracker: Linear

Issues and maps for this repo live in Linear, workspace `<workspace>`, team `<TEAM>`; ids look like `<TEAM>-42`. Use the `linearis` CLI (`npm i -g linearis`; `linearis auth login` once per machine, `linearis auth status` checks it). It prints JSON. Discover flags with `linearis usage` and `linearis <domain> usage` rather than guessing. Pull requests live on the git host (see the end).

<Only when the repo maps to more than one team: a routing section saying which team and `--project` each area goes to, and which team takes work that spans them. Label names can't repeat across teams, so give one team's copies a prefix (`jnd:`) and say so.>

On Windows, don't call `linearis.cmd` through `cmd.exe` with multi-line arguments: `cmd.exe` cuts them at the first newline. Call `node <npm-root>/linearis/dist/main.js` directly. (`--file` exists only on `issues batch create|update`; `create`, `update`, `discuss` and `reply` take text.)

## Issues

- **Create**: `linearis issues create "<title>" --team <TEAM> --description "<body>" --labels <a>,<b>`. Add `--parent-ticket <map>` for a map's child and `--blocked-by <id>` for a blocker.
- **Read**: `linearis issues read <id>`, then `linearis issues discussions <id>` for the comments.
- **List**: `linearis issues list --team <TEAM> --label <label>` (`--parent <map>`, `--unassigned`, `--has-blockers`).
- **Comment**: `linearis issues discuss <id> --body "<text>"`.
- **Labels**: `linearis issues update <id> --labels "<a>,<b>" --label-mode add` (or `remove`). Plain `--labels` overwrites.
- **Close**: comment the explanation, then `linearis issues update <id> --status Done`.
- **Blocking**: `linearis issues update <blocked> --blocked-by <blocker>`.
- **Create a label**: `linearis labels create <name> --team <TEAM>`. Always scope labels to the team: another team's label of the same name can match a workspace-wide one.

## Wayfinding operations

- **Map**: one issue labelled `wayfinder:map`.
- **Child ticket**: a sub-issue of the map (`--parent-ticket <map>`), labelled `wayfinder:<type>` and `model:<tier>`, plus any labels the tracker requires on every issue: `<the repo's answer, or none>`.
- **Frontier**: `linearis issues list --parent <map> --unassigned`, dropping any with an open blocker; first in map order wins.
- **Claim**: `linearis issues update <id> --assignee me`, the session's first write.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist and link) to the map's Decisions so far.
- **Tier**: two calls, since one `--label-mode` can't do both: remove the old `model:` label (`--label-mode remove`), then add the new one (`--label-mode add`).

## Pull requests

On `<git host>`, with `Closes <id>` in the body so Linear links it.

- **Open a draft**: `gh pr create --draft --title "..." --body-file <file>`.
- **Mark ready**: `gh pr ready <n>`.
- **Landing check**: `<the repo's checks on what changed>`. Known failing on `main`: `<each test, its issue, and the check that skips it; or none>`.
- **Land**: `<command>`. It merges `origin/main` into the branch, runs the landing check on that tree, and merges only when it passes. On GitHub: `node .claude/skills/land-pr/land-lock.mjs --pr <n> -- node .claude/skills/land-pr/land-github.mjs <n> -- "<check>"...`, which merges with `gh pr merge <n> --match-head-commit <sha>` (a merge commit, else the method the repo allows, after any required checks pass).
