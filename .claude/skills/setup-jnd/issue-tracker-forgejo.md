# Issue tracker: Forgejo

Issues, maps and pull requests for this repo live on Forgejo at `<url>`, repo `<owner>/<repo>`. Use the `tea` CLI (`tea login add` once per machine; `tea whoami` checks it; `tea login default <name>` makes it the default). `git push` needs its own credential: a `credential.<url>.helper` that reads the same token file at push time; without one the first push fails with "could not read Username". Where `tea` has no command, call the REST API through `tea api 'repos/{owner}/{repo}/<path>'`, which fills in the repo and the login. It exits 0 on an HTTP error, so pass `-i` and read the status line it prints to stderr.

Forgejo has no sub-issues: a map's children carry a `map:<n>` label naming the map, and the map body links them.

## Issues

- **Create**: `tea issues create --title "..." --description-file <file> --labels <a>,<b>`.
- **Read**: `tea issues <n> --comments --output json` (the body and every comment, without terminal formatting).
- **List**: `tea issues list --state open --labels <label> --output json`.
- **Comment**: `tea comment <n> "$(cat <file>)"`.
- **Labels**: `tea issues edit <n> --add-labels <a>` / `--remove-labels <a>`.
- **Close**: comment the explanation, then `tea issues close <n>`.
- **Blocking**: Forgejo's native dependencies: `POST /issues/<child>/dependencies` with `{"owner":"<owner>","repo":"<repo>","index":<blocker>}`. `GET /issues/<n>/dependencies` lists a ticket's blockers; it's startable when none is open.

## Wayfinding operations

- **Map**: one issue labelled `wayfinder:map`. Create its `map:<n>` label once the map has a number.
- **Child ticket**: an issue labelled `map:<n>`, `wayfinder:<type>` and `model:<tier>`, plus any labels the tracker requires on every issue (`<the repo's answer, or none>`), linked from the map body.
- **Frontier**: open issues labelled `map:<n>` with no open blocker and no assignee; first in map order wins.
- **Claim**: `tea api -i -X PATCH 'repos/{owner}/{repo}/issues/<n>' -d '{"assignees":["<your Forgejo login>"]}'`, the session's first write. Not `tea issues edit --add-assignees`: tea 0.16 sends that to an endpoint Forgejo answers with 404, and nothing is assigned.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist and link) to the map's Decisions so far.
- **Tier**: remove the old `model:` label and add the new one.

## Pull requests

- **Open a draft**: `tea pulls create --draft --title "..." --description-file <file> --head <branch> --base main`. `--draft` prepends `WIP:`, which is Forgejo's draft. Forgejo reports a `WIP:` PR as `mergeable: false` whatever its state, so check for conflicts with `git merge-tree --write-tree origin/main HEAD` (exit 1 means a conflict), never the API's flag.
- **Read**: `tea pulls <n> --comments --output json`; the diff is `git diff origin/main...<branch>`.
- **Mark ready**: `tea pulls edit <n> --title "<title without WIP:>"`.
- **Landing check**: `<the repo's lint, format and typecheck of what changed>`. Known failing on `main`: `<each test, its issue, and the check that skips it; or none>`.
- **Land**: `node .claude/skills/land-pr/land-lock.mjs --pr <n> -- node .claude/skills/land-pr/land-forgejo.mjs <n> -- "<check>"...`. Through `land-pr`'s lock, it merges `origin/main` into the branch, runs each quoted check on that tree, pushes, and merges by the repo's default style, pinned to the head it checked, only when they pass. Use the repo's own script instead when it has one.
