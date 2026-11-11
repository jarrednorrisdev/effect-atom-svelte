---
name: ship
description: Take one ticket, or the work in this thread, from change to landed PR, then report. Use in a thread launched for a ticket, or when the user says "full send" or "full stop".
---

# Ship

You own the work from its current state to a landed PR. There are three ways in:

- **Launched for a ticket.** Your **parent** is the thread whose handoff started you; its threadId is in your first message. You answer to it, never to Jarred directly.
- **"full send".** Jarred is not watching this thread and wants the work done end to end. Your updates go unread until long after you stop. Land the PR once it's mergeable.
- **"full stop".** The same as full send, but stop with the PR ready for Jarred to land. Never land it, enable auto-merge or push to the default branch.

A handoff that says Jarred asked for it to run autonomously is a full send. If Jarred did not clearly say "full send" or "full stop", and no parent launched you, don't assume this autonomy.

The repo supplies the commands: its tracker doc and `docs/agents/` say how to read, claim and label a ticket, open a PR, and land one.

## Before you start

- **Deferred tools.** Preload the T3 tools you'll use in one `ToolSearch` call before the first one: `select:mcp__t3-code__link_pull_request,mcp__t3-code__t3_thread_send,mcp__t3-code__t3_thread_launch,mcp__t3-code__delegate_task,mcp__t3-code__t3_thread_organize`. A direct call fails until then.
- **Read the ticket** and its comments.
- **Tier check.** Check the ticket against `wayfinder`'s `tiers.md` and the repo's high-risk areas before opening any source file. If the ticket is bigger than the model this thread runs on, stop before changing more: move it up a tier, comment on the ticket why, and report, so the parent relaunches it. Don't carry on under-powered. A ticket already on Opus that's too big is too big for one ticket: report that, and the parent splits it. If the tier was more than the work needed, finish, and suggest a lower tier for similar tickets in the report.
- **Branch.** A launched thread already runs in its own worktree on its branch; don't create another. On the default branch in a one-off thread, create a branch first.

## Asking for a decision

Ask the parent, not Jarred. Send the question with `t3_thread_send` (`mode: "queue"`, a stable `clientRequestId`): the options, and your recommendation with the reason. Then end your turn; the answer arrives in this thread. Never call `AskUserQuestion` in a launched thread. Questions on Jarred's list go to the parent too, marked as such; it passes them up. Jarred's list:

- the repo's "Stop and ask a human before" list in `AGENTS.md`;
- a taste call with no precedent in the repo's decisions: the look, the tone, player-facing copy Jarred hasn't seen;
- reversing a decision Jarred made. Reconciling two existing decisions, or filling in a detail one leaves open, is not a reversal.

Record each answer where it belongs (the ticket's comment, the review comment's Fixed row, an ADR), tagged `decided by <the parent's title> for Jarred`.

In a full send or full stop there is no parent. Ask only when you cannot continue alone, and use `AskUserQuestion` so the thread shows it's waiting. Put all the context in the question: the PR link, what blocks you, and the options with your recommendation first. Decide everything else yourself with sensible defaults, and list those decisions in the report.

**A ticket that ends in a decision, not a PR** (grilling, prototype, research): follow the skill its handoff names. A grilling or prototype ticket is worked with Jarred: in an attended map, put each round to him here, in this thread, and end your turn until he answers (the one exception to asking only your parent); in a full-send map, follow `grilling`'s "Full send". Record the resolution as the ticket's comment, close it, and go straight to step 7. Steps 1 to 6 are for changes.

## 1. Make the change

Complete the goal with the smallest change that works. Fix the case that happened, not every case that could. Follow the repo's rules for what to run while working.

Where the repo has tests and the change has behaviour, build it with `tdd`, at the seams the ticket names. A bug that doesn't reproduce at first glance gets `diagnosing-bugs`.

## 2. Prove it

Proof is evidence you observed yourself in this session: command output, a reproduction, a screenshot. Use the most direct proof the change allows:

- Reproduce the original failure, apply the fix, then watch the same reproduction pass.
- Add one focused test that fails without the fix, when the behaviour has none and the repo has a test setup.
- For UI and runtime behaviour, run the app and look at the change. Green mocked tests do not prove the user experience works.

The landing runs lint, format and typecheck on what changed. Run the related tests yourself only when the change is risky, and say why in the PR's "Checks run". When you cannot find a way to prove a change, you do not have full confidence: ask.

A full send or full stop is the permission for the test methods proof needs, even when a project file says to ask first or to leave testing to Jarred (computer use, browser automation, running the app, screenshots). Rules about how to test still apply. It covers only the tests this task needs, and bypasses no harness approval prompt.

## 3. Open the PR

Re-read the ticket's comments first: the ticket may have grown since you started. Then open a draft PR with `file-pr`, with `Closes <ticket>` in the body and one short line on how you proved the change.

## 4. Hand over to a landing thread

Review fixes and landing run in a fresh, small thread, so they don't pay for this thread's context. Hand over only when this thread has used more than about 80k tokens of context; below that, go on to step 5 here. Launch it with `t3_thread_launch`:

- `title`: your own title with ` · land` added.
- `workspaceStrategy`: `{type: "existing_worktree", worktreePath: "<this worktree>"}`. Commit and push first.
- `modelSelection`: Sonnet, unless the review is likely to need design work the ticket's tier was chosen for.
- `delegatedFrom`: your parent, when you have one.
- `message`: "Use the `ship` skill from step 5. First link the PR to this thread with `link_pull_request`." Then the handoff: the ticket, the PR, the branch, how you proved the change, anything a reviewer will ask about, your own threadId, the parent's threadId and report id (or "full send" / "full stop"), and open questions.

Then end your turn. Don't settle this thread yourself: settling can remove the worktree the landing thread is using. T3's auto-settle settles both threads when the PR merges.

Hand over the same way, at the next natural break, if this thread nears 200k tokens of context before the PR is open. Its message then says which step to resume from.

## 5. Review

Run `review-pr`. Send each **decide** to the parent as in "Asking for a decision", and apply the answer as `review-pr` says.

## 6. Land

Before landing, file any follow-up work as tickets. Then:

- **`human:verify` on the ticket, or a full stop:** don't land. Report the PR as ready for Jarred and wait. A full stop also turns off any auto-merge and takes the PR out of any merge queue.
- **Otherwise:** land with `land-pr` once `review-pr` ends mergeable. A review that stops short of mergeable doesn't land: report the PR and its open items.

## 7. Report

Landing is the last thing you change. If T3 hasn't settled the ticket thread that handed over to you once the PR merged (it can't see Forgejo PRs until `tea` is set up), settle it yourself (`t3_thread_organize`, `settle`, its threadId). Everything meant for Jarred goes in the report, never only in this thread: it settles once the PR merges, and he won't see it.

**With a parent:** call `t3_thread_send` with `threadId` = the parent, `mode: "queue"` and the report id as `clientRequestId`. The message starts with `Report from <title>:` and covers:

- what was built, the ticket and PR as links, and the PR's merge state and review score
- tickets filed, and what is now unblocked
- anything waiting on Jarred
- a **Retro**, only when something went wrong (review needed 2 rounds of fixes, landing failed, the thread got stuck) or the session shows a real improvement to the process, not a nit specific to this ticket: follow the `retro` skill, and report the candidates to your parent in place of presenting them. Implement none of them.

**Full send or full stop:** the final message is the report: the PR link, its merge commit or "open and unmerged", your proof, and each decision you made. Then mark this thread unread (`t3_thread_organize`, `mark_unread`), so it reaches Jarred's inbox even after it settles.

## Waiting

Never write a polling loop, a `sleep` loop or repeated `task_status` calls. Run long commands, landing included, so they block until they end, logged to a file that ends with an `exit` line. A wait can return before that line is written: then wait again. After a restart, read that log and the PR's state before rerunning anything.

## Going deeper

A ticket that needs threads of its own makes this thread a coordinator: follow `wayfinder`, with your parent as its parent, and report up only once your children have reported.
