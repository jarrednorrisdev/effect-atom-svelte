---
name: modernize
description: Get an old PR up to date, or recommend closing it. Use when asked to update, rebase or "modernize" a PR.
---

# Modernize

Modernize the idea, not just the branch. A clean merge does not prove that the PR still belongs in the product.

## Guardrails

- Fetch first: the PR's branch, `main`, and any other branch related to the work.
- Treat existing worktree changes as Jarred's. When the active worktree is dirty or in use for other work, do this in a fresh worktree.
- Modernizing authorizes updating the PR branch. It does not authorize merging, closing, changing the base branch, or expanding scope.
- Bring the branch up to date by merging `origin/main` into it. Never rebase or force-push a pushed branch: the repo may refuse it, and `review-pr` reads its rounds from the branch's history.
- Post a PR comment only if Jarred asked for one, opened as `review-pr`'s "Other comments" says.

## Establish the PR's intent

Resolve the PR and record its URL, state, base, head branch, current head SHA, author, and review state. Read the title, body, linked tickets, commits, review comments, and complete diff. State the smallest coherent goal the PR was trying to accomplish before judging its implementation.

Record the merge base, so the original PR and the base branch's later changes can be compared separately.

## Check what changed around it

Inspect the commits and diffs added to the base branch since the PR diverged. Search merged and open PRs when titles, code paths, or behavior suggest a replacement or competing implementation.

Look beyond overlapping lines:

- Has the same user-facing problem already been solved?
- Did APIs, types, schemas, dependencies, or architectural boundaries change?
- Do both sides now claim ownership of the same behavior or invariant?
- Was the code being changed deleted, moved, or intentionally simplified?
- Would landing the PR restore an old behavior or create two ways to do the same thing?
- Is the original benefit still large enough to justify the maintenance cost?

Do not describe a PR as current merely because Git reports no conflicts.

## Choose a disposition before pushing

- **MODERNIZE**: the goal is still useful and the implementation remains the right shape. Merge `main` in, resolve conflicts, test, and push.
- **REWORK**: the goal is still useful, but a mechanical update would preserve the wrong implementation. Explain the smallest credible rewrite and stop before pushing, unless Jarred also asked for that rework.
- **CLOSE**: the PR is superseded, obsolete, directionally wrong, or no longer worth its cost. Cite concrete evidence and stop. Do not spend time updating an obsolete branch, and do not close it without explicit permission.

Be willing to recommend CLOSE. Age alone is not evidence, and sunk effort is not a reason to keep a PR alive.

## Update without losing intent

For MODERNIZE:

1. Merge `origin/main` into the PR's branch.
2. Resolve each conflict according to the PR's intent and the base branch's newer invariants. If a conflict reveals a product or architecture disagreement, stop and reconsider the disposition instead of guessing.
3. Compare the PR's own change before and after: `git diff <old merge base> <old head>` against `git diff origin/main...HEAD`. Confirm that no intentional behavior disappeared and no already-landed behavior was reintroduced.
4. Run the repo's focused checks for the touched area. Distinguish real failures from pre-existing or infrastructure failures.
5. Push.

Do not merge the PR.

## Report

Lead with MODERNIZE, REWORK, or CLOSE and the reason. Then summarize:

- meaningful changes on the base branch;
- conceptual conflicts, or confirmation that none were found;
- the update and push result, if performed;
- checks run and their results;
- the remaining decision or work, with a link to the PR.

Separate observed facts from judgment. Say what could not be verified instead of manufacturing confidence.
