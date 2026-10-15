---
name: merge-prs
description: Merge effect-atom-svelte pull requests once Jarred says so: confirm every check passed, pick squash or merge commit, rebuild and retarget a PR stacked on one that was squashed, then fast-forward main and remove merged worktrees. Use when Jarred says to merge, land or ship PRs, or to clean up after merging.
---

# Merging PRs

Merge only on Jarred's say-so in this conversation: a go-ahead covers the PRs it names, not later ones.

## 1. Ready

For each PR, in merge order (a stacked PR after its base):

- `gh pr checks <n>`: every check passed on the PR's current head. `deploy` shows as skipping on every PR; that's expected.
- `gh pr view <n> --json mergeStateStatus,isDraft`: `CLEAN`, and not a draft (`gh pr ready <n>`).
- The body is true of the PR as it stands: every name and claim matches the final diff, the test results name the browsers they ran in, and nothing it lists as open has been decided.

Checks still running: mark it ready, `watch_pull_request`, and end the turn. A check that fails: stop and tell Jarred what failed, with the job's output.

## 2. Merge

- **Squash** when the history holds replaced or reverted attempts, or the PR's body asks for it. Otherwise a merge commit, the repo's default.
- Squash subject: the PR's conventional title with `(#<n>)`. Body: a few lines on what changed, and the `Co-Authored-By` line from the system reminder.

```sh
gh pr merge <n> --squash --subject "<title> (#<n>)" --body "<summary>"
```

## 3. A PR stacked on one just squashed

Its branch still carries the base's original commits, which `main` no longer has. Rebuild it as one commit on the new `main`:

```sh
git fetch origin
git diff <base's last commit> <stacked PR's last commit> > /tmp/pr.patch
git checkout -B <branch>-rebuilt origin/main
git apply --index /tmp/pr.patch && git commit -F <message file>
git diff --quiet <stacked PR's last commit> HEAD && echo identical   # true when main is the base's last commit
git branch -f <branch> HEAD && git checkout <branch> && git branch -D <branch>-rebuilt
git push --force-with-lease=<branch>:<stacked PR's last commit> origin <branch>
```

GitHub retargets the PR to `main` once the base's branch is deleted; if it hasn't, `gh pr edit <n> --base main`. Change the body's "Stacked on #N" line to "Builds on #N, now merged". Then back to step 1 for it: its CI runs again.

## 4. Afterwards

- Fast-forward the main checkout: `git checkout main && git merge --ff-only origin/main`.
- `unwatch_pull_request` each merged PR.
- For each merged PR's worktree: confirm `git status --short` is empty, then `git worktree remove <path>` and `git branch -D <branch>`. Keep `esa-pr-assets`. Leave other worktrees alone unless Jarred asks: some belong to open PRs.

Report the merge commits, and anything left: open PRs, worktrees kept, follow-ups.
