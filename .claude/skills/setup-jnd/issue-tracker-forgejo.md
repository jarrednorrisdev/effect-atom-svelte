# Issue tracker: Forgejo

Issues, maps and pull requests for this repo live on Forgejo at `<url>`, repo `<owner>/<repo>`. Use the `tea` CLI (`tea login add` once per machine; `tea whoami` checks it; `tea login default <name>` makes it the default). Where `tea` has no command, call the REST API (`<url>/api/v1/repos/<owner>/<repo>`) with the token `tea` was logged in with, read at run time and never printed.

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
- **Claim**: `tea issues edit <n> --add-assignees <bot account>`, the session's first write.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist and link) to the map's Decisions so far.
- **Tier**: remove the old `model:` label and add the new one.

## Pull requests

- **Open a draft**: `tea pulls create --title "WIP: ..." --description-file <file> --head <branch> --base main`. A `WIP:` title is Forgejo's draft. Forgejo reports a `WIP:` PR as `mergeable: false` whatever its state, so check for conflicts with `git merge-tree --write-tree origin/main HEAD` (exit 1 means a conflict), never the API's flag.
- **Read**: `tea pulls <n> --comments --output json`; the diff is `git diff origin/main...<branch>`.
- **Mark ready**: `tea pulls edit <n> --title "<title without WIP:>"`.
- **Landing check**: `<the repo's lint, format and typecheck of what changed>`.
- **Land**: `<command>`. It merges `origin/main` into the branch, runs the landing check on that tree, and merges only when it passes.
