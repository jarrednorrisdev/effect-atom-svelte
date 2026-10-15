---
name: wayfinder-orchestrator
description: Run a wayfinder map from one coordinator thread that launches a T3 thread per ticket, in parallel where tickets don't collide, until the destination is reached.
argument-hint: "The map ticket, or the idea to chart"
disable-model-invocation: true
---

This thread is the **coordinator** for one map. It charts the map with the repo's wayfinder skill (`.claude/skills/wayfinder/SKILL.md`), then works no decision ticket itself: each ticket runs in its own T3 thread and worktree, reports back here, and the coordinator launches whatever that unblocks. Wayfinder's rules (plan, don't do; refer by name; the map body; fog of war) hold throughout; this skill only changes who works the tickets.

This repo's tracker is GitHub issues: `docs/agents/issue-tracker.md` holds the `gh` commands for the map, sub-issues, blocking, claiming and resolving.

Record this thread's `threadId` from `t3_thread_list` (`currentThreadId`) once, verbatim with its `mcp:` prefix: every handoff names it.

## 1. Chart

Chart the map per wayfinder's "Chart the map", or adopt an existing map ticket. Run the research tickets from here as parallel subagents: each on a throwaway `research/<name>` branch in a temp worktree under the org's `worktrees/` (run `bun install` there so hooks run), findings in one Markdown file, pushed, no PR, then resolved on the ticket and the map. Done when the map body is written, every child ticket exists with its blockers wired, and the research tickets are resolved.

## 2. Launch the frontier

The **frontier** is the open, unblocked, unassigned children. An assigned ticket is claimed, and may already have a thread: check `t3_thread_list` before treating one as free.

Launch every frontier ticket that doesn't **collide** with another running one. Two tickets collide when they decide the same thing or write the same file. Split ownership instead of serialising where you can (one decides what a hook is, the other where hooks live) and name the owner in both handoffs.

For each ticket:

1. Write the handoff per step 2 of `~/.claude/skills/next-session/SKILL.md`, saved in `~/Documents/repos/jnd/scratchpad/effect-atom-svelte/handoffs/`, with these changes:
   - **Recording the resolution:** the decision is the ticket's resolution comment, then close the ticket and add its line to the map's Decisions so far, per "Resolve" in `docs/agents/issue-tracker.md`. No docs file or PR. The map body is shared: re-read it immediately before `gh issue edit` and change only your own line.
   - Replace "Then write the next handoff…" with: report to the coordinator with `t3_thread_send` to `<coordinator threadId>`: what closed, what changed on the map and neighbouring tickets, the frontier now, and a recommended next ticket.
   - **Parallel sessions:** list the sibling tickets running now and who owns any overlap; a question that depends on a sibling goes to the user, never decided twice.
2. Claim it: `gh issue edit <n> --add-assignee @me`.
3. Launch it per step 3 of the next-session skill. Batch independent launches in one turn.

Done when every non-colliding frontier ticket has a running thread.

## 3. Order the user's attention

Grilling threads all wait on the user. Give an answering order, first to last, ranked by how many tickets each unblocks; a ticket whose answers lean on another's goes after it. Re-rank after every report.

## 4. On each report

1. Relay it in a few lines: what was decided, linking the ticket by name, plus anything needing the user's eye, such as an ADR the thread proposed.
2. Forward to running threads what they now need (a sibling's decision, a merged PR, an in-flight external dependency) with `t3_thread_send`, one stable `clientRequestId` per message.
3. Launch what the report unblocked (step 2), and new tickets it created.
4. Give the re-ranked answering order.

Boundaries with other maps: message that map's thread to agree the line, ask it to copy its reply here, and record the agreed line in this map's Notes or Out of scope. The user decides any line both threads proposed.

## 5. Destination

When the last ticket closes, check the map per wayfinder: Not yet specified is empty or moved to Out of scope. Then tell the user, and propose:

- closing the map ticket;
- launching the first build ticket in its own thread (a build handoff: code, PR, review, report back here);
- cutting any tickets on other maps that the build waits on.

Act on what the user agrees. Done when every agreed launch has a `threadId`, reported as `[title](t3-thread://v1/<threadId>)`.
