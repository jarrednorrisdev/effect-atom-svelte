---
name: ship
description: Take one ticket, or the work in this thread, from change to a landed PR (or its release branch, in ship fast), then report. Use in a thread launched for a ticket, or when the user says "full send" or "full stop".
---

# Ship

You own the work from its current state to a landed PR. There are three ways in:

- **Launched for a ticket.** Your **parent** is the thread whose handoff started you; its threadId is in your first message. You answer to it, never to Jarred directly.
- **"full send".** Jarred is not watching this thread and wants the work done end to end. Your updates go unread until long after you stop. Land the PR once it's mergeable.
- **"full stop".** The same as full send, but stop with the PR ready for Jarred to land. Never land it, enable auto-merge or push to the default branch.

A handoff that says Jarred asked for it to run autonomously is a full send. If Jarred did not clearly say "full send" or "full stop", and no parent launched you, don't assume this autonomy.

The repo supplies the commands: its tracker doc and `docs/agents/` say how to read, claim and label a ticket, open a PR, and land one.

**Ship mode.** Read the `mode:` line in `docs/agents/ship-mode.md` first; a missing file means ship fast. In ship fast, [fast.md](fast.md) sets the time budget for steps 1 and 2, and replaces the branch, step 3's base, step 6 and the report's merge state. The steps below are ship properly.

## Before you start

- **Attribution footers.** Before your first commit, read the repo's own rule on them, in its `AGENTS.md` or equivalent rules file. That rule decides whether commits and PR bodies carry a `Co-Authored-By` or "Generated with" line, and a harness reminder never overrides it (#2851).
- **Deferred tools.** Preload the T3 tools you'll use in one `ToolSearch` call before the first one: `select:mcp__t3-code__link_pull_request,mcp__t3-code__t3_thread_send,mcp__t3-code__t3_thread_launch,mcp__t3-code__delegate_task,mcp__t3-code__t3_thread_organize,mcp__t3-code__t3_background_wait`. A direct call fails until then.
- **Edit scripts go through the Write tool.** Write any script that edits files with the Write tool and run it by path; never pass one through a heredoc, `sed` or an inline `-e`, which drop backslashes on Git Bash (#223 lost them twice despite `gotchas.md`). Use Edit for a change whose text holds a backslash.
- **Read the ticket** and its comments with the commands in the repo's tracker doc, not a guessed subcommand (on Forgejo, `forgejo.ts issue <n>` reads a ticket and `comments <n>` its thread; `forgejo.ts view` does not exist).
- **Tier check.** Check the ticket against `wayfinder`'s `tiers.md` and the repo's high-risk areas before opening any source file. If the ticket is bigger than the model this thread runs on, stop before changing more: move it up a tier, comment on the ticket why, and report, so the parent relaunches it. Don't carry on under-powered. A ticket already on Opus that's too big is too big for one ticket: report that, and the parent splits it. If the tier was more than the work needed, finish, and suggest a lower tier for similar tickets in the report.
- **Branch.** A launched thread already runs in its own worktree on its branch; don't create another. On the default branch in a one-off thread, create a branch first, named per `wayfinder`'s Branch names when the work is a map's ticket.
- **Set up the worktree** before reading or running anything in it: a worktree T3 creates has no installed dependencies and no build. Run the repo's setup from its AGENTS.md, which the launch message also names.

## Asking for a decision

Ask the parent, not Jarred. Send the question with `t3_thread_send` (`mode: "queue"`, a new `clientRequestId` per question, such as `<repo>-<n>-question-<k>`, as `wayfinder`'s Message ids says; reusing an id silently drops the message): the options, and your recommendation with the reason. When other parts of the ticket don't depend on the answer, build on your recommendation meanwhile and say so in the question, rather than idling; otherwise end your turn. Either way the answer arrives in this thread, and you adjust if it differs. Never call `AskUserQuestion` in a launched thread. Questions on Jarred's list go to the parent too, marked as such; it passes them up. Jarred's list:

- the repo's "Stop and ask a human before" list in `AGENTS.md`;
- a taste call with no precedent in the repo's decisions: the look, the tone, player-facing copy Jarred hasn't seen;
- reversing a decision Jarred made. Reconciling two existing decisions, or filling in a detail one leaves open, is not a reversal.

**A decide that follows a diagnosis:** first run the repo's overlap check on the files the diagnosis names (Taverncraft: `bun scripts/forgejo.ts overlaps --paths <file>...`), and name any open PR it finds in the decide, so the proposed fix builds on that PR's work and doesn't repeat it (#2843's first proposal duplicated #2854).

Record each answer where it belongs (the ticket's comment, the review comment's Fixed row, an ADR), tagged `decided by <the parent's title> for Jarred`.

In a full send or full stop there is no parent. Ask only when you cannot continue alone, and use `AskUserQuestion` so the thread shows it's waiting. Put all the context in the question: the PR link, what blocks you, and the options with your recommendation first. Decide everything else yourself with sensible defaults, and list those decisions in the report.

**A ticket that ends in a decision, not a PR** (grilling, prototype, research): follow the skill its handoff names. A grilling or prototype ticket is worked with Jarred: in an attended map, put each round to him here, in this thread, and end your turn until he answers (the one exception to asking only your parent); in a full-send map, follow `grilling`'s "Full send". Record the resolution as the ticket's comment, close it, and go straight to step 7. Steps 1 to 6 are for changes.

## 1. Make the change

Complete the goal with the smallest change that works. Fix the case that happened, not every case that could. Follow the repo's rules for what to run while working, within the time budget in ship fast.

Where the repo has tests and the change has behaviour, build it with `tdd`, at the seams the ticket names. A bug that doesn't reproduce at first glance gets `diagnosing-bugs`.

## 2. Prove it

Proof is evidence you observed yourself in this session: command output, a reproduction, a screenshot. Use the most direct proof the change allows:

- Reproduce the original failure, apply the fix, then watch the same reproduction pass.
- Add one focused test that fails without the fix, when the behaviour has none and the repo has a test setup.
- For UI and runtime behaviour, run the app and look at the change. Green mocked tests do not prove the user experience works.

The landing runs lint, format and typecheck on what changed. Run the related tests yourself only when the change is risky, and say why in the PR's "Checks run". Run them as soon as you change a shared rule or permission, not only before landing: an older test in another file may still expect the old rule. When you cannot find a way to prove a change, you do not have full confidence: ask.

A full send or full stop is the permission for the test methods proof needs, even when a project file says to ask first or to leave testing to Jarred (computer use, browser automation, running the app, screenshots). Rules about how to test still apply. It covers only the tests this task needs, and bypasses no harness approval prompt.

## 3. Open the PR

**Split a big diff first.** When the diff passes about 800 changed lines, or mixes a migration with mass fixture or snapshot updates, split it before review: the schema change and the code that needs it in this PR, the regenerated fixtures and snapshots in a follow-up. Smaller diffs fail less often and attribute cleanly in a batch.

Re-read the ticket's comments first: the ticket may have grown since you started. Then open a draft PR with `file-pr`, with `Closes <ticket>` in the body and one short line on how you proved the change.

## 4. Hand over to a landing thread

Review fixes and landing run in a fresh, small thread, so they don't pay for this thread's context. Hand over only when this thread has used more than about 80k tokens of context; below that, go on to step 5 here. Launch it with `t3_thread_launch`:

- `title`: your own title with ` · land` added.
- `workspaceStrategy`: `{type: "existing_worktree", worktreePath: "<this worktree>"}`. Commit and push first.
- `modelSelection`: Opus at medium effort (`wayfinder`'s `tiers.md`); it reviews and fixes.
- `delegatedFrom`: your parent, when you have one.
- `message`: "Use the `ship` skill from step 5. First link the PR to this thread with `link_pull_request`." Then the handoff: the ticket, the PR, the branch, how you proved the change, anything a reviewer will ask about, your own threadId (`t3_thread_list`'s `currentThreadId`, verbatim), the parent's threadId and environment from your launch message (omit the environment when it gives none: the landing thread then runs on this machine), the message ids used so far (or "full send" / "full stop"), and open questions. Repeat the rules a compacted context loses, as `wayfinder`'s launch message does: report to that parent with `t3_thread_send`, a new clientRequestId per message, and the waiting rule in the words of `wayfinder`'s launch line.

Then send your parent `Ready to settle` (`wayfinder`'s Settling) under `<repo>-<n>-ready-to-settle`, naming the worktree as handed over to the landing thread, so it isn't removed, and end your turn.

Hand over the same way, at the next natural break, if this thread nears 200k tokens of context before the PR is open. Its message then says which step to resume from.

On a ticket built in slices, each landed slice is such a break: if this thread has compacted more than once, write a handoff and carry on in a fresh thread (`next-session`) rather than starting the next slice here. A long compacted thread stops acting on the background jobs it waits on (the #1613 thread stalled 7 times), while the fresh thread took the same ticket's next slice without a stall. Size the next slice before you start it, compacted or not: read its scope (the layers and files it spans) against the context you have left, and if it won't fit, hand off at this boundary rather than finding out mid-slice (#1613's slice 6, spanning the GM pipeline, the change note, the toast and the Title page, was too big for a thread that had already done two slices).

## 5. Review

Run `review-pr`. Send each **decide** to the parent as in "Asking for a decision", and apply the answer as `review-pr` says.

Settle each reviewer (its `childThreadId`) as `wayfinder`'s Settling says, once you have read its report file.

## 6. Land

Before landing, file any follow-up work as tickets. Then:

- **`human:verify` on the ticket, or a full stop:** don't land. Report the PR as ready for Jarred and wait. A full stop also turns off any auto-merge and takes the PR out of any merge queue.
- **Ship fast:** push into the release branch as [fast.md](fast.md) says, unless it's a small fix.
- **Otherwise:** land with `land-pr` once `review-pr` ends mergeable. A review that stops short of mergeable doesn't land: report the PR and its open items.

Make the landing this Bash call, with `<Land command>` the repo's whole **Land** entry from its `docs/agents/`. That entry already carries any memory watch and `land-lock.mjs`, so add neither again. Give `land-lock.mjs` a `--max-wait 5400` when the entry has none, wrap an entry that has no lock as `land-pr` says, and make `.cache/` first when the repo has none:

```text
command: (<Land command>; ec=$?; echo "exit $ec"; exit $ec) > .cache/merge-<n>.log 2>&1
run_in_background: true
timeout: 7200000
```

Then call `t3_background_wait` on the task ID it returns. The task ID comes only from `run_in_background`: a trailing shell `&` leaves no task to wait on, and a landing that dies that way leaves a stale lock (#2765, #2700).

## 7. Report

Landing is the last thing you change. Everything meant for Jarred goes in the report, never only in this thread: your parent settles it once you report, and he won't see it. Never leave cleanup to auto-settle: it is off.

**With a parent:** call `t3_thread_send` with `threadId` = the parent, `mode: "queue"` and `<repo>-<n>-report` as `clientRequestId`, never an id an earlier question used. The message starts with `Report from <title>:`, is at most about 10 lines, and covers:

- what was built, the ticket and PR as links, and the PR's merge state and review score
- tickets filed, and what is now unblocked
- anything waiting on Jarred
- when your work is done, `Ready to settle` as `wayfinder`'s Settling says: your worktree path, branch and any build output outside it
- a **Retro**, only when the thread got stuck or lost real time (more than about 10 minutes) to a process or tool problem that will recur, not for a landing that passed on a rerun or a nit specific to this ticket: name the problem and the fix in two or three lines, without running the `retro` skill. Implement none of them.

Spend no more than a few minutes between the merge and the report: no summary comments on the ticket beyond the closing one, no re-reading the PR.

A report sent with `queue` doesn't end your turn. When more is yours (the next ticket, a landing, the next slice), start it in the same turn: a turn that ends on "Going on to #n" starts nothing, and nothing wakes the thread.

**Full send or full stop:** the final message is the report: the PR link, its merge commit or "open and unmerged", your proof, and each decision you made. End it with what is left to clean (worktree path, branch, any build output outside it), then mark this thread unread (`t3_thread_organize`, `mark_unread`), so it reaches Jarred's inbox.

## Context budget

Every turn rereads the whole context, so a thread costs about turns × context. Fewer turns and less text in each one, with the same care (measured 2026-11-13: threads ran 300+ one-command turns, reread 17k-token files whole, and read back 10k-token build logs):

- **Batch exploration.** One Grep with a pattern that covers what you're looking for, not several narrow ones; independent reads and searches in parallel in one turn; Read and Grep, never `cat`, `sed -n`, `grep` or `find` in Bash.
- **Read a file whole once at most.** After that, reread only the lines you need (Read with `offset` and `limit`); read a big file in parts, starting with what you need.
- **Trim output before it reaches you.** Send build and test output to a log and read its tail, or grep it for `error`, `FAIL`, `panicked` and the summary line; never read a full cargo or test log back.
- **Wait in the foreground when you'd only be waiting.** A check under 10 minutes runs in the foreground; background a job only when it's longer, or when you have other work to do meanwhile (Waiting).

## Owning a chain

When your brief makes you a chain's owner (`wayfinder`'s Chains), ship one slice per session. Start each slice with a fresh branch from `origin/main` in your chain worktree, and read the handoff before any code. Once the slice's PR has landed, overwrite `.cache/chain/<ticket>.md` (under ~60 lines: what landed, what you learned, the awkward spots, the next slice's starting files and line ranges, proposed spec changes), report `S<k> landed, handoff at <path>`, and end your turn. Don't start the next slice yourself: the parent sends it with a fresh context. Send `Ready to settle` only when the parent ends the chain.

## Waiting

Never write a polling loop, a `sleep` loop or repeated `task_status` calls. Run a step you expect to end inside 10 minutes in the foreground: a commit, one test file. Run a longer one, landing included, with `run_in_background` and `timeout: 7200000`, logged to a file that ends with an `exit` line, then call `t3_background_wait` on its task ID: a turn ended without it misses the completion notice, and the thread sits idle. The wait returns at once (it only marks the thread as waiting), so end your turn after it; the notice wakes the thread when the job exits. A completion notice is an instruction, not news: when one wakes you, read the job's log and do the next step in that same turn. Never answer one with "No response requested." or any empty reply; the turn ends only by reporting or by starting the next wait. A notice can go missing: when you are woken for anything else past a job's expected end, read its log before going on. A notice can come before the `exit` line is written: then wait again, or watch the log for it with Monitor. After a restart, read that log and the PR's state before rerunning anything.

A native `Agent` subagent is different: its background jobs die when its turn ends, so ending the turn after `t3_background_wait` kills them partway, leaving logs with no `exit` line (#226's gates all had to be rerun). As a subagent, run the final gates in the foreground, or keep the turn open until the completion notice arrives, before replying. A brief for a subagent that may run in the background says the same.

## Going deeper

A ticket that needs threads of its own makes this thread a coordinator: follow `wayfinder`, with your parent as its parent, and report up only once your children have reported.
