---
name: hunt-bugs
description: Run the bug-hunting loop on effect-atom-svelte and its devtools: hunt for bugs with parallel agents, prove each with a failing test, verify it adversarially, fix in batched draft PRs, review the fixes, and repeat. Use when Jarred asks to find bugs, harden the tests, audit the library, or run the bug loop (e.g. "find bugs and open PRs", "keep looping until I'm back").
---

# Hunt bugs

One **loop** is: hunt, verify, fix, ship. Jarred usually asks for several loops while he is away, so each loop must end with draft PRs open, not with findings waiting on him. A finding counts only once a **red** test proves it: a test that fails on `main` for the reason claimed.

## 0. Start

- `git fetch origin` and fast-forward `main`.
- Create every worktree under `~/Documents/repos/jnd/worktrees/` (`git worktree add … origin/main`), never inside the repo. Run `bun install` in each. `gh` and the commit identity switch to the personal account there.
- List what is already known, so hunters don't find it again: open PRs (`gh pr list`), recent `fix` commits (`git log --oneline origin/main | grep -i fix`), and open issues. This is the **known list** every brief carries.

## 1. Hunt

Launch background agents in parallel, one per area in [references/areas.md](references/areas.md), with the brief in [references/hunter-brief.md](references/hunter-brief.md). Pick areas that previous loops covered least. From the second loop on, one agent instead reviews the fixes the previous loops opened (the review area): fixes are the likeliest place for new bugs.

Done when every agent has reported. If one has gone quiet for well past its peers, act on what the others found and fold its report into the next loop; never leave Jarred's time idle waiting on it.

## 2. Verify

A hunter's failing test is a claim, not a verdict. For each finding, launch a reviewer (batched by area) told to disprove it. The finding survives only if:

- the behaviour it expects is promised by the JSDoc, the docs pages (`apps/demo/src/routes/**/+page.md`) or the README;
- `@effect/atom-react` doesn't behave the same way (if it does, it's probably intended: change the docs, not the code);
- it isn't Effect's own behaviour that the library inherits (then it's a docs note, or a workaround plus an issue);
- the scenario is one a real app reaches.

Re-run a sample of the red tests yourself. Sort the survivors into: fix, docs-only, upstream, or not a bug. Done when every finding has a verdict with its reason.

## 3. Fix, in batched draft PRs

One PR per area, so CI runs once per batch. For each PR:

- Bring each red test into the existing test file for its area, named by the behaviour it checks, not as a repro or with a hunt prefix. Tests ship in the PR that fixes them.
- Make the fix. Check every new test fails without it and passes with it (copy `src` aside, `git checkout -- src`, run, restore).
- Run `cd packages/effect-atom-svelte && bunx vitest run --project "browser (chromium)" --project server`, the devtools package's `bunx vitest run`, root `bun run format`, `bun run lint` and `bun run check`. Firefox fails locally; leave it to CI. Build the library first (`bun run --cwd packages/effect-atom-svelte build`): the devtools tests and `test/devtools-panel.browser.test.ts` import its `dist`, and without it the browser run fails in confusing ways.
- Add a changeset (`bun run changeset`), user-facing. A PR that only adds tests to a package still needs one: `bunx changeset add --empty`.
- Commit, then push only after reading the test totals. Gate the push on them; a `grep` that matched in a `&&` chain says nothing about whether tests passed.
- `gh pr create --draft`. The body lists each bug: what broke, the scenario, the fix, the test. Then `link_pull_request` and `watch_pull_request`.

Two PRs that edit neighbouring lines always conflict: stack the second on the first (`--base <first-branch>`) and say so in its body.

## 4. Check them together

Merge every open fix branch into one scratch worktree and run all the suites there, Chromium and WebKit. Resolve conflicts as each PR's body says; write the resolution into the body of the PR that will merge second. Done when the combined tree is green, or each failure is traced to one PR and fixed there.

## 5. Repeat

Start the next loop at step 1. Stop at the loop count Jarred gave, or when he's back. Report as you go in a sentence or two: what each loop found, what it opened.

## Upstream bugs

When the cause is in Svelte or Effect: work around it in the library if the workaround is clean, open an issue in this repo to remove it once upstream is fixed (what the bug is, where the workaround lives, the steps to undo it), and draft the upstream issue with a minimal repro. Filing upstream posts publicly as Jarred: draft it, and file only when he says so.

## Merging, when Jarred asks

- Merge in dependency order with `gh pr merge <n> --merge --delete-branch`.
- Deleting a branch closes the PRs stacked on it. Retarget them first: `gh pr edit <n> --base main`.
- A PR reopened or retargeted needs a fresh `ci-ok` before `main`'s ruleset lets it merge. Auto-merge is off.
- A docs-site e2e failure in one WebKit shard (streams, Pagefind search) has been a flake on test-only changes: `gh run rerun <run> --failed` once the run has finished, before investigating.
