# Release prep

Ship fast only (`ship`'s [fast.md](../ship/fast.md)). One release thread turns `release/vX.Y.Z` into one PR on `main`, a tag and release notes. The root launches it on Jarred's word, on a worktree with branch `release-prep/vX.Y.Z` cut from `release/vX.Y.Z`, which is frozen meanwhile; its parent is the root. The commands are in the repo's `docs/agents/ship-mode.md`: the compile check, the full run, tagging and release notes.

Every ticket in the branch was reviewed but never built, so expect the compile check to find mismatches between tickets. Fix each one the smallest way that keeps both tickets' intent; a fix that changes what a ticket does is a decide for the root.

1. **Merge.** `git fetch origin`, then merge each feeder (`origin/release/vX.Y.Z-<name>`), then `origin/main`, into `release-prep/vX.Y.Z`, one merge at a time; resolve each conflict, commit and push. A merge is not a build.
2. **Compile loop.** Run the compile check, fix what it reports, commit, and run it again, until it's clean. Read only the errors from its log, not the whole output. Hand this to one focused subagent when this thread's context is already large; only one ever runs the loop.
3. **Full run, once.** Run the full run in the background, logged as `ship`'s Waiting says. Fix each failure, then rerun only the failing tests or steps until they pass. Rerun the whole thing only when a fix touched something shared by much more than the failures. Push.
4. **One PR.** Open it with `file-pr` against `main`, titled `release: vX.Y.Z`, its summary the milestone's closed tickets in a line each, with the compile and full runs under "Checks run". Run `review-pr` on the release-prep commits only (`--since` the head of `release/vX.Y.Z`, so the merge resolutions are reviewed too, and `--spec-file` saying so): the tickets were each reviewed already. Land it with `land-pr`.
5. **Tag and notes.** Tag the merge commit `vX.Y.Z` and write the release notes from the milestone's closed tickets, with `ship-mode.md`'s commands. Close the milestone where the tracker closes them (a Linear milestone stays open) and delete the release branch and its feeders on the remote.
6. **Report** to the root: the tag, the PR, what the compile loop and the full run caught, and `Ready to settle`.
