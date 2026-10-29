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

**PRs as a request surface: yes.** This repo takes outside PRs (#66 was one), so they run through the same labels and states as issues.

The `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --title "<map name>" --label wayfinder:map --body-file <file>`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`/`build`) and `model:<haiku|sonnet|opus>`, plus `human:verify` on a rare ticket Jarred must see before it lands. The repo requires no other label on an issue. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge by issue number with `gh issue edit <child> --add-blocked-by <blocker>` (or `gh issue create --blocked-by <blocker>`), and remove one with `--remove-blocked-by`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open, unassigned children in map order with `gh api repos/{owner}/{repo}/issues/<map>/sub_issues --paginate --jq '.[] | select(.state == "open" and (.assignees | length) == 0) | .number'`. Then drop any with an open blocker: `gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '[.[] | select(.state == "open")] | length'` counts them, so anything above 0 is blocked. The first that remains wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far. The resolution comment is where the decision lives; no docs file or PR is needed for it. A decision that should outlive the map becomes an ADR through `domain-modeling`.
- **Map body edits**: other sessions edit the map concurrently, so re-read it (`gh issue view <map> --json body -q .body`) immediately before `gh issue edit <map> --body-file <file>`, and change only your own line.
- **Tier**: `gh issue edit <n> --remove-label model:<old> --add-label model:<new>`.

## Pull requests

PRs live on GitHub too. Squash is the only merge method the repo allows (merge commits and rebase merges are off), and the PR's title becomes the commit's subject with `(#<n>)` added, so a title follows the conventional style of recent commits (`fix(forms): …`, `chore: …`, `docs: …`). `main` requires the `ci-ok` check and rejects force-pushes; a PR branch may be force-pushed.

- **Open a draft**: `gh pr create --draft --title "..." --body-file <file>`. A change to a published package needs a changeset (`bun run changeset`, committed with it); a change to tooling, agent docs or the docs site alone needs none.
- **Read**: `gh pr view <n>`, then `gh pr view <n> --comments`, and `gh pr diff <n>`.
- **Checks**: `gh pr checks <n> --required` lists the required check. `--watch` waits for it; exit code 8 means pending. The `deploy` job skips on every PR.
- **Mark ready**: `gh pr ready <n>`.
- **Landing check**: `bun run lint` and `bun run check` (oxfmt and oxlint; svelte-check and typecheck, cached by Turborepo). Both read the libraries' build, so build it first in a new worktree (`bunx turbo run build --filter='./packages/*'`), then run `bunx svelte-kit sync` in `apps/demo`: Turborepo's cache can skip the sync inside `bun run check`, and without SvelteKit's generated types `bun run lint` fails on `any` errors in the demo's routes. The tests run in CI, whose `ci-ok` check gates the merge. Run a package's tests yourself only when the change is risky (`CONTRIBUTING.md`, "Tests"). Known failing on `main`: none.
- **Land**: `node .claude/skills/land-pr/land-lock.mjs --pr <n> -- node .claude/skills/land-pr/land-github.mjs <n> -- "bun run lint" "bun run check"`. Through `land-pr`'s lock, it merges `origin/main` into the branch, runs each check, pushes, and squashes with `gh pr merge <n> --squash --match-head-commit <sha>` (`land-github.mjs` picks squash on its own, since merge commits are off). `ci-ok` has to pass on the pushed head before GitHub accepts the merge: when the merge is refused, `land-github.mjs` waits for the required checks and merges once they pass (a failing required check still ends in "gh pr merge failed"), so run the command in the background with a log file (a PR the CI skips as already tested passes in about a minute).
- **A PR stacked on a landed one**: `land-pr`'s rebuild applies, since the squash leaves its branch carrying the base's original commits.
- **After it merges**: GitHub deletes the remote branch. Remove the PR's worktree and local branch once `git status --short` is empty there. Keep `esa-pr-assets`, the worktree of the `pr-assets` branch that `explainer-diagram` publishes to (`docs/agents/diagrams.md`).
