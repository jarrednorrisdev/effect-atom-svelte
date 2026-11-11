# Issue tracker: GitHub

Issues, maps and pull requests for this repo live on GitHub, at `<owner>/<repo>`. Use the `gh` CLI for every operation; it infers the repo from `git remote -v`.

## Issues

- **Create**: `gh issue create --title "..." --body-file <file> --label <a>,<b>`. Write multi-line bodies to a file first.
- **Read**: `gh issue view <n> --json number,title,body,labels,assignees,comments`.
- **List**: `gh issue list --state open --label <label> --json number,title,labels,assignees`.
- **Comment**: `gh issue comment <n> --body-file <file>`.
- **Labels**: `gh issue edit <n> --add-label <a>` / `--remove-label <a>`.
- **Close**: post the explanation with `gh issue comment`, then `gh issue close <n>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.
- **Sub-issue**: `gh issue create --parent <map> ...`, or `gh issue edit <map> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<map>/sub_issues -F sub_issue_id=<child-db-id>`, where the database id is `gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number`.
- **Blocking**: GitHub's native issue dependencies: `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (0 means startable).

## Wayfinding operations

- **Map**: one issue labelled `wayfinder:map`.
- **Child ticket**: a sub-issue of the map, labelled `wayfinder:<type>` and `model:<tier>`, plus any labels the tracker requires on every issue: `<the repo's answer, or none>`.
- **Frontier**: the map's open sub-issues (`gh api repos/<owner>/<repo>/issues/<map>/sub_issues --jq '.[] | select(.state == "open")'`) with no open blocker and no assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist and link) to the map's Decisions so far.
- **Tier**: `gh issue edit <n> --remove-label model:<old> --add-label model:<new>`.

## Pull requests

- **Open a draft**: `gh pr create --draft --title "..." --body-file <file>`.
- **Read**: `gh pr view <n>`, then `gh pr view <n> --comments`, and `gh pr diff <n>`.
- **Mark ready**: `gh pr ready <n>`.
- **Landing check**: `<the repo's lint, format and typecheck of what changed>`. Known failing on `main`: `<each test, its issue, and the check that skips it; or none>`.
- **Land**: `node .claude/skills/land-pr/land-lock.mjs --pr <n> -- node .claude/skills/land-pr/land-github.mjs <n> -- "<check>"...`. Through `land-pr`'s lock, it merges `origin/main` into the branch, runs each quoted check on that tree, pushes, and merges with `gh pr merge <n> --match-head-commit <sha>` (a merge commit, else the method the repo allows, after any required checks pass) only when they pass. Use the repo's own script instead when it has one.
