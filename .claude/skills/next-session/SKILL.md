---
name: next-session
description: Hand this session's work to a fresh T3 thread in its own worktree, through a handoff in the scratchpad - the next ticket, or the same work when context runs low. Use outside the factory, where no wayfinder launches the next ticket.
argument-hint: "The next ticket, or what the next session will focus on"
---

Close the current session by handing its work to a fresh T3 thread. Two cases:

- **The next ticket.** The current ticket is finished first; this skill starts nothing on the next one.
- **The same work, continued.** Context is running low; the fresh thread picks up where this one stops.

In the factory, `wayfinder` launches each ticket and the threads hand over themselves; this skill is for work outside it.

## Steps

1. **Pick the work.** For the same work, skip to step 2. Otherwise use the ticket the user named, or recommend the open, unblocked, unassigned ticket that the most other tickets wait on, and confirm it with the user. An assigned ticket is already claimed. The repo's tracker doc (named in `AGENTS.md` / `CLAUDE.md`) holds the commands. Done when the user has agreed the ticket.

2. **Write the handoff** to the scratchpad: the `scratchpad/<repo>/handoffs/` folder beside the repo's main checkout, where the main checkout is the parent of `git rev-parse --path-format=absolute --git-common-dir` and `<repo>` is its folder name. Create the folder if it's missing. Name the file `<YYYY-MM-DD>-<slug>.md`: `<slug>` is the branch name without its prefix (`jarred/`, `feature/`, `fix/`). The branch is the tracker's suggested branch name when it gives one (Linear's `branchName`), otherwise the repo's documented branch convention; for the same work, the current branch. Model it on the newest handoff in that folder, if there is one. Sections:
   - **Opening**: the ticket and its map as named links, the skills to follow, and the branch the thread runs on.
   - **Why this ticket**: what it unblocks. For the same work: where this session got to.
   - **The question**: the decision to make or the next step, sharpened with what this session learned.
   - **Read first**: paths, with line ranges or section names, and the exact command for anything off the default branch.
   - **Recording the resolution**: the PR, ticket and map updates that close it, and which neighbouring tickets to revise. End it with: "Then write the next handoff with the `next-session` skill."
   - **Context from the last session**: open threads, unanswered requests.
   - **Parallel sessions**, when other threads edit the same files: keep the branch current with `git fetch origin && git merge origin/main`, since rebasing a pushed branch needs a force-push.

   Carry over from the newest handoff only what this work needs; setup the repo already does for itself (such as builds its tooling runs before a check) stays out. Point at specs, ADRs, tickets, commits and diffs rather than restating them. Standing preferences already live in `AGENTS.md`, `CLAUDE.md` and memory, so leave them out. Redact secrets: API keys, passwords, personal data. Done when a fresh agent could start from the file alone. Then claim a new ticket by assigning it to the driving dev, so a parallel session's step 1 skips it.

3. **Launch the thread** with `t3_thread_launch`:
   - `title`: the ticket's name, or the work's.
   - `workspaceStrategy`: for the next ticket, `{"type":"worktree","baseRef":"main","branch":"<branch>","startFromOrigin":true}`. For the same work, this thread's checkout: `{"type":"existing_worktree","worktreePath":"<this worktree>"}`, or `{"type":"root"}` when this thread runs in the project checkout. Then stop editing it.
   - `message`: "Read the handoff first and follow it: `<handoff path>`. This thread runs on branch `<branch>`. Don't create another branch or worktree." Then one line naming the ticket or work and how to work it.

   Done when the launch returns a `threadId`.

4. **Report** the handoff path and the thread as `[title](t3-thread://v1/<threadId>)`, with the `threadId` copied verbatim.
