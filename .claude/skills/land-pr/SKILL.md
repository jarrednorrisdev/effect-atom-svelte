---
name: land-pr
description: Land a mergeable PR on main, one landing at a time per repo, and log how long it waited. Use from `ship` once `review-pr` ends mergeable, for a ship-fast release or small fix, or when Jarred says to land or merge a PR.
---

Land only a PR `review-pr` left mergeable, or one Jarred told you to land. The repo's `docs/agents/` names its **Land** command: it merges `origin/main` into the branch, runs the landing check on that tree, and puts the result on `main` (Taverncraft: `bun scripts/forgejo.ts pr merge <n>`; a GitHub or Forgejo repo: `node <this skill's folder>/land-github.mjs` or `land-forgejo.mjs` `<n> -- "<check>"...`, which also refuse a draft, uncommitted changes to tracked files, or the wrong branch). Merge the way the repo does; never use `--admin` or another bypass.

In ship fast (`ship`'s `fast.md`), a ticket goes into its release branch, not through here. This skill then lands two things: a release PR, prepared first by [release.md](release.md), and a small fix, with `ship-mode.md`'s **Small-fix land** in place of the Land entry.

## 1. Ready

- The PR is open, its review comment reads mergeable, and no **decide** is open.
- The ticket has no `human:verify` label, and this isn't a full stop. Either one means stop: report the PR as ready for Jarred instead.
- The body is true of the PR as it stands: every claim matches the final diff, and nothing it lists as open has since been decided.
- **Pre-queue check.** When the repo's `docs/agents/` names one, run it in the PR's worktree and get it green before the Land command: it merges `origin/main` and runs the fast checks on what changed, so a PR that would fail the landing gate fails alone, here, instead of failing a batch and re-running everyone's check (lexicontent #1759). Commit and push what it merged or regenerated.
- Mark it ready for review: drop the `WIP:` title on Forgejo, or `gh pr ready <n>` on GitHub.

## 2. Land

Run the repo's whole **Land** entry from its `docs/agents/`, from the PR's own worktree. That entry already carries any memory watch and `land-lock.mjs`, so add neither again: wrapping it a second time refuses the landing. Give `land-lock.mjs` a `--max-wait 5400` when the entry has none.

Only an entry with no lock gets wrapped:

```sh
node <this skill's folder>/land-lock.mjs --pr <n> --max-wait 5400 -- <the repo's Land entry>
```

- If such an entry has no memory watch and the repo's `docs/agents/` names a **Memory watch** for landings, put it in front of the whole command, outside the lock, so it also watches the wait: `<the repo's memory watch> -- node <this skill's folder>/land-lock.mjs --pr <n> --max-wait 5400 -- <the repo's Land entry>`.
- The lock lets one landing run at a time in the repo, across every worktree on this machine, so `main` doesn't move under it. Exit code 75 means another landing still held it past `--max-wait`: run the same command once more. While it waits it prints a line each time the holder changes or the count of landings waiting beside it does, so the log's last `waiting for` line names who holds the lock now; a busy machine's landings can each wait an hour on heavy slots.
- A holder rewrites a heartbeat in the lock every 30 seconds for as long as its landing runs. A lock is stale, and another landing takes it over, only when its holder's pid is dead or its beat is more than 5 minutes old, never because of how long the landing has run. A landing frees only a lock it still owns. Stopping `land-lock.mjs` with a signal stops the Land command first, then frees the lock and exits 130.
- Run it in the background, since a wait for the lock can outlast a foreground call's 10-minute limit, with `timeout: 7200000` (the 30-minute default kills a landing still queued) and its output going to a log file, with the `--max-wait 5400` above so a queue of other landings doesn't end it with exit 75, then call `t3_background_wait` on its task ID, or you miss its completion notice. The wait returns at once, so end your turn after it; the notice is an instruction, not news: when it wakes you, read the log and do the next step (the report, or the fix and a rerun) in that same turn, and never reply "No response requested." to it. The same timeout and wait go for a commit whose hook queues for a heavy slot. Read the log's `exit` line before going on; a notice can come before that line is written: then wait again, or watch the log for it with Monitor.
- **Batches** (`land-forgejo.mjs`): the holder takes up to 2 waiting landings whose checks are a subset of its own into its run. It merges them as a chain (the waiters in queue order, itself last), runs the checks once on the result, then merges each PR in turn, pinned to its link of that checked chain. If the batch's check fails, or a member's landing is stopped before the first merge, it lands every member alone instead. A waiter in a batch prints `rode in PR <n>'s batch` and its own result, and exits with its PR's code; the check output is in the holder's log. A line `unchecked-prefix` means the batch stopped partway with main on a tree that no run checked as a whole: the output says whether a later check covered it. `JND_LAND_BATCH_MAX=1` turns batches off.
- **Prepare hook** (`land-forgejo.mjs`): a Land entry that sets `LAND_PREPARE_CMD` runs it after each merge and before the checks, with `LAND_PREPARE_BASE` naming the commit merged in (main, or in a batch the chain so far). What it commits is checked and landed, as a repo's migration renumbering does (lexicontent #1764). It runs from the branch's own copy of this script, so a branch that predates the hook lands without it: the repo's check should catch what the hook would have fixed. A refusal naming `LAND_PREPARE_CMD` is the repo's hook failing: read its output above the line.
- **After hook** (`land-forgejo.mjs`): a Land entry that sets `LAND_AFTER_CMD` runs it once after a run that merged anything, with `LAND_AFTER_PRS` (the PRs merged, in order) and `LAND_AFTER_MAIN` (main after them), so the repo can tell the threads that care at once (lexicontent #1768). It is best effort and killed after `LAND_AFTER_TIMEOUT_S` (300): a `LAND_AFTER_CMD failed` line never undoes a landing that exited 0.
- **Culprits** (`LAND_CULPRIT_CMD`, when the repo's Land entry sets it): a failed run asks the repo's hook whose failure it was. An infrastructure or known-flaky failure runs the same tree once more. Otherwise the PRs it names leave with exit 1 and a `leaves the batch` line naming the step and tests, and the rest is checked once more and lands only if that passes; a failure it can't attribute checks the batch in halves instead. Each run's output is kept in `jnd-land-runs/` beside the landing log, and a PR that leaves a batch or fails gets a `land:` comment. Fix your PR from that line; you aren't requeued.
- It appends a line to the repo's landing log (wait, run time, exit code, check runs, a note), which is how we check the lock is working. `node land-lock.mjs --stats` prints the last week's medians, the check runs per landed PR and how failed batches were attributed.
- Touch nothing in the worktree while it runs.
- Each quoted check runs in the platform shell (`cmd.exe` on Windows), so `VAR=x cmd` doesn't work there: set environment variables around the whole `land-lock.mjs` call. A check must leave the tree clean. In a repo with a task cache (Turborepo), a check can replay a result from another worktree: the inputs are hashed, so a replayed pass counts.
- CI doesn't gate the landing; the landing check does. Name any CI check the Land command warns is failing or pending in your report.

**When it refuses:**

- **A red check:** it names each failed task. Fix it, commit, push, and land again. That needs no new review round unless the fix changes what the PR does. When the red test is in a file the PR doesn't touch, run that one file on a clean checkout of `origin/main` before landing again (through the repo's heavy-job slots, if it has them): if it fails there too, `main` is red, so report it to your coordinator, file a ticket if none exists, and don't land again until it's fixed; only a file that passes on `main` may be retried as a flake.
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
- **Worktree.** Leave your own worktree in place: your parent removes it when it settles you, after your `Ready to settle` (`wayfinder`'s Settling), sent under a new `clientRequestId` (Message ids). Never remove another thread's worktree.

Then go back to `ship` to report.
