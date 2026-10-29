---
name: file-pr
description: Open a concise draft PR, or rewrite a PR's body. Use when opening, filing or creating a PR.
---

# File PR

## Before opening

- Check whether a PR for this branch already exists.
- Review the diff against the base branch (`git diff origin/main...HEAD`) to make sure its contents match the goal.
- When the change unifies a duplicated expression, grep the repo for every copy first: a copy missed here surfaces only in review.
- When the PR changes a command's flags or usage, grep the docs and skills for the old usage: a doc that still shows it surfaces only in review.
- When the PR does part of a later ticket, comment on that ticket saying which part.

## Title

PR titles become merge commit messages, so follow the repo's title conventions: look at recently merged PRs and the git history. Prefer a concise, human-readable title that says why the change matters:

BAD

> ❌ perf(server): negotiate permessage-deflate on the websocket

GOOD

> ✅ perf(server): cut websocket frame size by 70%+ with gzipping

## Body

Skip preambles and keep prose brief, in the repo's domain language from its glossary. Drop a section that has nothing in it.

```markdown
## Summary

<the problem, then the fix, in a sentence or two; then the smallest visual that makes the key point clear>

## Evidence

- **Before:** <screenshot, output or failing test run> **After:** <screenshot, output or passing test run>

## Merge Danger

**Door:** <one-way or two-way>

**Blast Radius:** <one word, then what could break>

Closes <ticket>

## How to verify by hand

1. <what to click through, and what to expect, or "Nothing to see">

## Checks run

- <each check you ran while working, and its result>
```

**Summary.** Open with a simple explanation of the problem, from the user's original request, then briefly explain the solution. Don't lead with an implementation inventory:

> ❌ Removed implicit workspace carry-over from every "new thread" entry point (cmd+n / cmd+shift+o, sidebar v1/v2 buttons, command palette). New threads inherit only the project from context; branch, worktree, and env mode always come from the configured defaults. Deleted buildContextualThreadOptions, startNewThreadInProjectFromContext, and the v1 sidebar's seed-context machinery.

> ✅ My "new worktree" default was ignored when starting new threads on existing worktrees. Super unintuitive. Now your preferences always apply.

Then add a visual only when it shows the shape faster than words. Pick the smallest: pseudocode for logic, a call tree for control flow, a component tree for UI structure, a shallow file tree for a refactor, a Mermaid sequence diagram for interaction, or a `diff` sketch of one of those when the point is what changes. A sequence too long for a sketch gets an `explainer-diagram`. Keep only the calls, files and states the reader needs.

**Evidence.** Concrete evidence that the change works, before and after. Screenshots are best when the change is visual. Next best is execution: the exact test that fails before and passes after, or the command output.

**Merge Danger.** A two-way door can be walked back; a one-way door (destructive, or hard to reverse) can't. The blast radius is what the change could break: consumers, layout, data.

**Checks run.** Record what you ran while working. The landing writes its own check line when it lands.

## Opening it

Open it as a **draft**: `gh pr create --draft`, or the repo's create command with a `WIP:` title on Forgejo. It stays a draft while `review-pr` runs, and `land-pr` marks it ready. Then link it to this thread with `link_pull_request`.

Before submitting, check the title, body and attachments for secrets and private details. End the body with the attribution line the harness gives, unless the repo's rules forbid one.

If `gh pr create` fails because GitHub's GraphQL rate limit is used up, open it through REST: `gh api repos/<owner>/<repo>/pulls -f title=... -f head=... -f base=... -F draft=true -F body=@<file>`.

## Before it lands

The body becomes the merge commit's body. Rewrite any claim the review rounds made stale.
