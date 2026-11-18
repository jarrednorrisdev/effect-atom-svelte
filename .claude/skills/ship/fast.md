# Ship fast

A repo's **ship mode** is the `mode:` line in its `docs/agents/ship-mode.md`: `mode: fast` or `mode: properly`. A missing file means ship fast. **Ship properly** is the default text of every skill: each ticket is its own PR to `main`, through the full landing check, with semver releases. **Ship fast** replaces the parts this file names; everything else in the skills holds in both modes.

Ship fast is for building quickly and refining later. The build and the whole test suite run once per release, not once per ticket, so the **review is the gate** each ticket passes.

The repo's `ship-mode.md` holds its specifics: the release branch names, the compile check, the full run, tagging and release notes, deploys and the time budget. A repo with no file uses this file's defaults: branch `release/vX.Y.Z`, the typecheck part of its landing check as the compile check, and the budget below.

## Releases

- **Milestones.** Work is tracked by release milestones on the tracker, versioned 0.x: a minor bump per release (`v0.4.0`), a patch milestone (`v0.4.1`) for small fixes that ship on their own, tagged once when its last fix lands. The tracker doc has the milestone commands.
- **Release branch.** Each milestone has one integration branch, `release/vX.Y.Z`. A large release may have two or three **feeders** (`release/vX.Y.Z-<name>`) that merge into it at release prep, or earlier when a ticket needs a feeder's code.
- **Which milestone.** Jarred picks each ticket's milestone. A map asks him once for all its tickets; he moves single tickets later.
- **Release prep** turns a release branch into one PR on `main`, a tag and release notes: `land-pr`'s [release.md](../land-pr/release.md), run by a release thread the root launches on Jarred's word.
- **Deploys** take only a tagged release.
- Nothing builds a release branch on a timer: release prep is its first full run.

## Time budget

Per ticket, with the numbers in `ship-mode.md` (defaults here):

- Run only the tests the ticket writes or changes: a few minutes at most (3).
- A build or test run of 3 to 10 minutes, such as a per-crate `cargo check`, needs Jarred's ok: ask the parent, as a question on Jarred's list.
- 10 minutes or more runs only in release prep, or when Jarred asks.

No full build, lint or test suite per ticket, and no landing. Proof (`ship` step 2) is the ticket's own tests and what fits this budget.

## A ticket

The thread works like `ship` says, with these steps replaced:

- **Branch.** The ticket's worktree starts from `origin/release/vX.Y.Z` (its milestone's branch, or feeder), not `main`. A ticket built on another ticket's code starts after that ticket is in the release branch, from its head: that code has never compiled, so read the signatures you call rather than trusting the ticket's description of them.
- **Open the PR** (step 3) as a draft with the release branch as its base.
- **Review** (step 5) as usual; `review-pr` adds the compiler's checks to the brief.
- **Into the release** (step 6, in place of landing). Once `review-pr` ends mergeable, with no `human:verify` and no full stop:

  ```sh
  git fetch origin
  git merge origin/release/vX.Y.Z
  git merge origin/main
  git push origin HEAD
  git push origin HEAD:release/vX.Y.Z
  ```

  Resolve each merge's conflicts and commit before the next command. No lock guards the release branch: a rejected push means another ticket got in first, so fetch, merge both again and push again. The release branch taking `main` with each ticket is how it keeps up with `main`; a merge is not a build. The host marks the PR merged once its head is in the release branch; close it with a comment if it doesn't. Comment `In release/vX.Y.Z at <sha>` on the ticket and close it, so the tickets blocked on it unblock.
- **Report** (step 7): `Ready for the release, head <sha>`, the release branch's sha after your push, in place of the merge state.

## Small fixes

A small fix that shouldn't wait for the release (a patch milestone) branches from `main`, opens its PR against `main`, gets its own tests and a review, and lands through `land-pr` with only its own tests as the check (`ship-mode.md`'s **Small-fix land**). The next release prep checks it with everything else. When it was the last open ticket in its patch milestone, tag the patch as `ship-mode.md` says.
