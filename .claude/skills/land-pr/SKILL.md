---
name: land-pr
description: Land a mergeable PR on main, one landing at a time per repo, and log how long it waited. Use from `ship` once `review-pr` ends mergeable, or when Jarred says to land or merge a PR.
---

Land only a PR `review-pr` left mergeable, or one Jarred told you to land. The repo's `docs/agents/` names its **Land** command: it merges `origin/main` into the branch, runs the landing check on that tree, and puts the result on `main` (Taverncraft: `bun scripts/forgejo.ts pr merge <n>`; a GitHub or Forgejo repo: `node <this skill's folder>/land-github.mjs` or `land-forgejo.mjs` `<n> -- "<check>"...`, which also refuse a draft, a dirty tree or the wrong branch). Merge the way the repo does; never use `--admin` or another bypass.

## 1. Ready

- The PR is open, its review comment reads mergeable, and no **decide** is open.
- The ticket has no `human:verify` label, and this isn't a full stop. Either one means stop: report the PR as ready for Jarred instead.
- The body is true of the PR as it stands: every claim matches the final diff, and nothing it lists as open has since been decided.
- Mark it ready for review: drop the `WIP:` title on Forgejo, or `gh pr ready <n>` on GitHub.

## 2. Land

Run the Land command through the lock, from the PR's own worktree:

```sh
node <this skill's folder>/land-lock.mjs --pr <n> -- <the repo's Land command>
```

- The lock lets one landing run at a time in the repo, across every worktree on this machine, so `main` doesn't move under it. It waits up to 5 minutes for the lock. Exit code 75 means another landing still holds it: run the same command once more.
- Run it in the foreground with a 10-minute timeout. When the Land command can take longer (it waits for a heavy slot or for required CI checks, or its check is long), run it in the background with its output going to a log file, and wait for its exit line before going on.
- It appends a line to the repo's landing log (wait, run time, exit code), which is how we check the lock is working. `node land-lock.mjs --stats` prints the last week's medians.
- Touch nothing in the worktree while it runs.
- Each quoted check runs in the platform shell (`cmd.exe` on Windows), so `VAR=x cmd` doesn't work there: set environment variables around the whole `land-lock.mjs` call. A check must leave the tree clean.
- CI doesn't gate the landing; the landing check does. Name any CI check the Land command warns is failing or pending in your report.

**When it refuses:**

- **A red check:** it names each failed task. Fix it, commit, push, and land again. That needs no new review round unless the fix changes what the PR does.
- **A conflict with `main`:** it's left in the tree. Resolve it, commit, push, and land again.
- **`main` moved anyway** (a landing from another machine): land again. Each retry shows in the log.

**After a restart**, or when a run's result is lost, read the PR's state before rerunning anything: a PR that already merged must not land twice.

## 3. Afterwards

- **A PR stacked on this one** (its base is this PR's branch): retarget it to `main` (`gh pr edit <n> --base main`). In a repo that merges, merge the new `main` into its branch and push. Only in a repo that squashes: its branch still carries this PR's original commits, so rebuild it as one commit on the new `main` (a force-push, so skip it where a pre-push hook refuses one, and merge `main` in instead):

  ```sh
  git fetch origin
  git diff <base's last commit> <stacked PR's last commit> > <tmp>/pr.patch
  git checkout -B <branch>-rebuilt origin/main
  git apply --index <tmp>/pr.patch && git commit -F <message file>
  git branch -f <branch> HEAD && git checkout <branch> && git branch -D <branch>-rebuilt
  git push --force-with-lease=<branch>:<stacked PR's last commit> origin <branch>
  ```

  Change its body's "Stacked on" line to "Builds on <PR>, now merged".
- **Watching.** If you watched the PR (`watch_pull_request`), the merge ends the watch. Only the thread that lands a PR ever watches it.
- **Worktree.** Leave your own worktree in place: T3 removes it when the thread settles. Never remove another thread's worktree.

Then go back to `ship` to report.
