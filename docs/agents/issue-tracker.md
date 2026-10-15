# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on [jarrednorrisdev/effect-atom-svelte](https://github.com/jarrednorrisdev/effect-atom-svelte/issues). Use the `gh` CLI for all operations. Commits, changesets and code comments refer to an issue as `#<n>`. Older ones cite `JND-<n>`, from a private tracker the project used before; those links only open for the maintainer.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <child> --parent <parent>` afterwards. This repo has sub-issues enabled.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --title "<map name>" --label wayfinder:map --body-file <file>`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge by issue number with `gh issue edit <child> --add-blocked-by <blocker>` (or `gh issue create --blocked-by <blocker>`), and remove one with `--remove-blocked-by`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open, unassigned children in map order with `gh api repos/{owner}/{repo}/issues/<map>/sub_issues --paginate --jq '.[] | select(.state == "open" and (.assignees | length) == 0) | .number'`. Then drop any with an open blocker: `gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '[.[] | select(.state == "open")] | length'` counts them, so anything above 0 is blocked. The first that remains wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far. The resolution comment is where the decision lives; no docs file or PR is needed for it. A decision that should outlive the map becomes an ADR through `/domain-modeling`.
- **Map body edits**: other sessions edit the map concurrently, so re-read it (`gh issue view <map> --json body -q .body`) immediately before `gh issue edit <map> --body-file <file>`, and change only your own line.
