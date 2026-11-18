---
name: wayfinder
description: Chart and run one map, a chunk of work too big for one agent session, from its coordinator thread. Grills Jarred while charting, then launches one T3 thread per ticket, answers their questions and takes their reports, until the map reaches its destination. Use when the root launches a wayfinder thread, or a ticket grows into work that needs threads of its own.
---

# Wayfinder

A loose idea has arrived, too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. This skill charts the way as a **shared map** on the repo's issue tracker, then runs it: each ticket gets its own T3 thread running `ship`, and reports back here. This thread is the map's **coordinator**. It works no ticket itself.

The destination is landed work by default: the map's build tickets ship as PRs. Naming the destination is the first act of charting: it shapes every ticket.

**Ship fast.** Read the repo's ship mode as `ship` says. In ship fast (`ship`'s `fast.md`), each build ticket ends in its milestone's release branch, not on `main`: the destination is reached when they're all in it, and landing is the release's job.

The repo's tracker doc (named in `AGENTS.md`, often `docs/agents/issue-tracker.md`) holds the commands for the map, child tickets, blocking, the frontier, claiming and resolving. [tiers.md](tiers.md) beside this skill holds the model tiers.

## Refer by name

Every map and ticket is an issue, so it has a **name**: its title. In everything Jarred reads, refer to it by that name, never by a bare id: a wall of `#42, #43, #44` is illegible. The id and link ride _inside_ the name, never stand in for it.

## Mode

The map's Notes hold its mode: **attended** (the default) or **full send**. Jarred switches it any time, through the root or by telling you; update the Notes and tell every running child.

- **Attended:** Jarred answers every grilling round himself, shown your recommendations.
- **Full send:** nobody is watching. Grilling still runs in rounds, but takes the recommended answers (`grilling`'s "Full send"), so the map keeps moving. Nothing stops for Jarred: his calls are taken too, tagged `to review`.

## The map

The map is a single issue labelled `wayfinder:map`, the canonical artifact. Its tickets are child issues of the map; on a tracker without sub-issues, the tracker doc says what makes an issue a child.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place, its ticket, so the map never restates it, only gists it and links. Open tickets aren't listed: they are open children, found by query.

```markdown
## Destination

<what reaching the end of this map looks like, in one or two lines>

## Notes

Mode: attended
Slug: <map-slug>
Milestone: <vX.Y.Z, in ship fast>

<Jarred's standing rules, word for word; domain; skills every ticket should consult; cross-cutting questions every ticket grills; standing preferences for this effort>

## Decisions so far

- [<closed ticket title>](link): <one-line gist of the answer>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

## Tickets

Each ticket carries one `wayfinder:<type>` label, one `model:<tier>` label (see [tiers.md](tiers.md)), and `human:verify` only when Jarred must see or play with the result himself before it lands. That should be rare: landing on its own is the default. A click-through after landing needs no label: it goes in the PR's "How to verify by hand". Those, plus what the tracker doc adds (such as a map label), are the only labels.

- **Research** (AFK): reading docs, third-party APIs or local sources to surface a fact a decision waits on. Resolved by a subagent with `research`.
- **Prototype** (HITL): a cheap, rough artifact to react to, with `prototype`, when "how should it look" or "how should it behave" is the question.
- **Grilling** (HITL): conversation, with `grilling` and `domain-modeling`.
- **Task** (AFK where it can, otherwise HITL): manual work a decision is blocked on: signing up for a service, provisioning access, moving data so its shape can be seen. A step only Jarred can do gets a `wizard`.
- **Build** (AFK): one slice of the change, shipped as a PR.

**HITL** means worked _with_ Jarred: in attended mode the ticket's own thread grills him directly, and the root's status lists it as waiting on him. The coordinator never answers a grilling round for him; in full send the recommendations are taken instead.

A decision ticket's body is the question:

```markdown
## Question

<the decision or investigation this ticket resolves>

Tier: <tier>, <why>
```

A build ticket's body is the contract its thread works from. Describe behaviour and interfaces, never file paths or line numbers: they go stale before the ticket starts.

```markdown
## What to build

<the end-to-end behaviour this slice makes work, in the glossary's terms>

## Acceptance criteria

- [ ] <each one independently checkable>

## Seams to test

<optional: the public interfaces `tdd` tests at, when you can name them now>

## Out of scope

<what this slice leaves alone>

Tier: <tier>, <why>
```

**Slicing build tickets.** Each slice cuts a narrow but complete path through every layer (schema, API, UI, tests): vertical, not one layer. A finished slice is demoable or checkable on its own. Prefactoring comes first: make the change easy, then make the easy change. **Wide refactors** are the exception: one mechanical change whose blast radius breaks thousands of call sites at once. Sequence it as **expand–contract**: add the new form beside the old, migrate the call sites in batches (each its own ticket, blocked by the expand), then delete the old form in a ticket blocked by every batch.

**Sizing.** Split tickets until each fits one thread in one session, well under the 200k-token handover. Pick the tier per [tiers.md](tiers.md).

Blocking uses the tracker's **native** dependency, so the tracker's own UI shows what's takeable. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children. Claiming is assigning: an open, unassigned ticket is unclaimed.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. **Not yet specified** holds the dim view of decisions you can tell are coming but can't yet pin down. The test is whether you can state the question precisely now, _not_ whether you can answer it now: a sharp question is a ticket, even when blocked. Don't pre-slice the fog into ticket-sized pieces: one patch may graduate into several tickets, or none.

Fog only ever gathers _toward_ the destination. Work beyond it is **out of scope**: close any ticket that turns out to sit there, and leave one line in **Out of scope** with the gist, the reason, and a link. It never graduates, and stays out of Decisions so far, which records the route actually walked.

## Branch names

Every map has a **slug**: short, lowercase and stable (`tooling`, `redesign`), set by whoever launches its coordinator and recorded in the map's Notes. It never changes once tickets launch. It is never `wayfinder` or a branch type.

- **Coordinator:** `wayfinder/<map-slug>`.
- **Ticket:** `<map-slug>/<type>/<slug>-<n>`, where `<type>` is the repo's branch type (`feat`, `fix`, `chore`, `proto`, `research`, `grill`) and `<n>` the ticket number, e.g. `tooling/chore/rustfmt-clean-35`. Drop `-<n>` only for research with no ticket.

No branch is ever named a bare map slug, nor `wayfinder/<map-slug>/...`: git can't hold one name as both a branch and a folder of branches. Existing branches keep their names.

## The thread tree

- **Your parent** is the thread whose message started you, usually the root. Its threadId is in your first message. Record your own `threadId` once from `t3_thread_list` (`currentThreadId`), verbatim, including any `mcp:` prefix.
- **Launch with `t3_thread_launch`**, never `delegate_task`, so every thread shows in Jarred's thread list. Pass `delegatedFrom` (this thread), so T3 draws the tree, and an explicit worktree: `workspaceStrategy: {type: "worktree", baseRef: "main", branch: "<map-slug>/<type>/<slug>-<n>", startFromOrigin: true}` (see Branch names). In ship fast a build ticket's `baseRef` is its milestone's release branch, or a small fix's `main`.
- **Launch on the ticket's tier**, per [tiers.md](tiers.md).
- **Title each child under the map's subject**, e.g. `Design language: Type scale (#n)`, so the list reads as a tree.
- **Hand over** to a fresh coordinator at a quiet moment once this thread nears 200k tokens of context: write the map's open state (running children, open questions, retro list) as a comment on the map ticket, launch the successor with the same message you were started with plus "Read the latest state comment on the map", tell each running child and your parent the new threadId, and end your turn.

## Message ids

Every `t3_thread_send` takes a `clientRequestId` that is unique to that message: `<repo>-<n>-<kind>`, numbered when the kind repeats, such as `<repo>-<n>-question-2`, `<repo>-<n>-answer-2`, `<repo>-<n>-report`, `<repo>-<n>-ready-to-settle`. A retry of the same message reuses its id; a new message never does. T3 treats a reused id as a retry and drops the message, while still returning the first message's messageId, so the send looks like it worked.

## Settling

T3's auto-settle is off and must never be relied on: it caused problems. A parent settles each of its children, and only once the child says it is ready.

- **The child**, as its last act once its work is done (PR landed, research pushed, decision recorded), sends its parent `Ready to settle: <title>` (its own message id, as Message ids says) with its worktree path, its branch, and any build output it left outside the worktree (an external `target/` dir, say). A worktree it handed to another thread is named as handed over, not to remove. Then it ends its turn. It never removes its own worktree.
- **The parent**, on that message: read the child's last message to check it has stopped running (a *completed* status can be a thread between turns, waiting on a background job), and check its branch has no open PR. Then, in this order: settle it (`t3_thread_organize`, action `settle`), since an unsettled thread's session still holds its directory and Windows refuses the removal; `git worktree remove <path>`, run from the main checkout, never from inside the worktree; then delete its build output: what it named, plus the per-worktree build dir the repo's `docs/agents/root.md` names, even when the child forgot to list it. When removal refuses over uncommitted changes, ask the child what they are; never `--force` past them. Then run `git worktree prune` and delete any directory left behind. This cleanup is part of settling, never deferred: a settled child with its worktree or build output still on disk is unfinished (Jarred, 2026-11-13; disks have filled up from leftovers).
- **A child that sends no such message** (an Agent-tool subagent, a reviewer) is settled the same way once you hold its result; its own worktree, if it had one, is in its result.

## 1. Chart

1. **Name the destination.** Grill Jarred here with `grilling` and `domain-modeling` until it's clear what this map is finding its way to. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first**: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. If this surfaces no fog (the whole journey fits one ticket), you don't need a map: file the ticket, launch it, and tell your parent.
3. **Check the breakdown.** The last round shows Jarred the tickets you'd create: title, type, tier, and what blocks what. In ship fast it also asks which milestone they go into, once for the whole map, with your recommendation; he moves single tickets later, through the root or here. In full send, take your own list and milestone, the milestone tagged `to review`.
4. **Create the map**: Destination and Notes filled in (with the mode, the map slug from your coordinator branch, and the cross-cutting questions every ticket grills, such as in-flight work on each state change, failure past retries, migrating old data), Decisions so far empty, the fog sketched into Not yet specified. Or adopt an existing map ticket.
5. **Create the tickets**, each with its type, tier and, in ship fast, milestone, then wire blocking edges in a **second pass** (issues need ids before they can reference each other). Write cross-references in that pass too, with real ids: a placeholder `#<n>` links to an unrelated issue.
6. **Run the research tickets** as parallel subagents (the Agent tool with worktree isolation, on the ticket's tier) that use `research`. Each works on a throwaway `<map-slug>/research/<name>-<n>` branch with its findings in one Markdown file, pushes the branch, opens no PR, posts a pointer comment on its ticket and closes it. Remove each one's worktree as Settling says once you hold its result. Then add every finding to Decisions so far yourself, in one edit, so parallel writers don't race on the map body.

Done when the map body is written, every ticket exists with its tier and blockers wired, and the research tickets are resolved.

## 2. Launch the frontier

An assigned ticket is already claimed and may already have a thread, so check `t3_thread_list` before treating one as free. Launch frontier tickets as soon as they are ready. Don't ask Jarred first.

**Wait for messages, don't poll.** Children report to you, and the timer gate tells you when a slot frees, so end your turn and let them wake you. Call `t3_thread_list` or read a thread only when a message points you at it or a report is overdue, never as a check-in loop: each call is a full-context turn (a coordinator's list calls once cost 185k tokens). Launch prompts carry `ship`'s Context budget, since a child may not reread the skill after compacting.

**Ready to build.** Launch a build ticket only when it is ready: no open question, acceptance criteria written, the files or areas it touches and the tests it adds named, its tier set, and **one-thread sized**: what one thread finishes without compacting more than once, about one layer plus its tests and under roughly 800 changed lines. Slice a schema change (the migration plus the code that needs it) apart from the fixture, seed and snapshot churn it causes: the schema slice lands first, and a follow-up regenerates fixtures and snapshots. Smaller diffs fail less often and attribute cleanly in a batch. Size and split work into slices when you file it, never mid-build: a slice split partway costs a re-plan and a handoff. A ticket that isn't ready gets **pre-grilled** while it queues: a grilling or research thread (they don't count toward the cap, as the repo's capacity setting says) settles its questions, so the next free slot starts coding at once. Keep the next few queued tickets ready ahead of the slots.

**Order the queue by what it unblocks.** Launch first the ticket that unblocks the most work, counting tickets on other maps that wait on it; keep the map's cross-map blockers listed in Notes so the other coordinator can plan around them. When another map waits on an API this map builds, open that ticket with a **contract slice**: the request and response types, the API spec and generated client, and a handler that answers 501 Not Implemented. It lands fast, the other map builds against the generated client with its own test fixtures, and the real behaviour follows in the next slices. The repo's high-risk areas still set the slice's review tier.

**Capacity.** Before each launch, read the repo's capacity setting (`docs/agents/root.md` names it). Launch only up to the cap across all maps; the rest wait for a slot. The timer gate tells you when one frees.

Launch every frontier ticket that doesn't **collide** with another running one. Two tickets collide when they decide the same thing or write the same file. Where you can, split ownership instead of running them one after the other (one decides what a hook is, the other where hooks live), and name the owner in both messages. Siblings that meet at a component also need an agreed seam: each message names the seam, or a blocker orders them so the second builds on the first's merge.

The launch message is short; `ship` holds the protocol:

- The first line: `Tier: <tier> (<model id>, <effort> effort).`
- "Use the `ship` skill. Your parent is `<your threadId>` (environment `<its environmentId>`); send every report and question there with `t3_thread_send`, each with its own clientRequestId: `<repo>-<n>-question-<k>` for the k-th question, `<repo>-<n>-report`, `<repo>-<n>-ready-to-settle`. Reuse an id only to retry the same message: T3 silently drops a new message under an old id." A child's context can be compacted away, and it may run on an older AGENTS.md, so the message, which survives, carries the parent and the rules below.
- "Step 1: set up the worktree, since T3 creates it with no installed dependencies and no build: <the repo's setup commands from its AGENTS.md, written out>. A shell redirect into a folder the setup makes, such as a log folder, fails until it has run."
- "Read your ticket and its comments with <the tracker doc's read commands, written out: on Forgejo `bun scripts/forgejo.ts issue <n>` and `comments <n>`; it has no `view`>."
- "After starting a background job you depend on, call `t3_background_wait` on its task ID, then end your turn: the wait returns at once, and the completion notice wakes you. When a notice wakes you, act on it and carry on. End a turn only by reporting or by starting the next wait."
- For a brief that hands over several PRs: "One worktree per PR, each clean at its PR's head", up front, since `review-pr`'s `render-brief` refuses any other checkout.
- In ship fast: "Ship fast: read `ship`'s `fast.md`. Your release branch is `release/vX.Y.Z`.", the time budget lines from `ship-mode.md`, and for a ticket built on another's unbuilt code, that ticket and the head it pushed.
- Jarred's standing rules from the map's Notes, word for word. A rule that arrives later goes to every running child at once, and into Notes.
- The ticket and map links, the map's mode, and for a decision ticket the skill to follow: grilling → `grilling` and `domain-modeling`, prototype → `prototype`.
- The decisions and research it builds on, with the commands to read them.
- The sibling tickets running now, and who owns any overlap. A question that depends on a sibling comes here, and you decide it once for both.

Every other brief you hand a thread that outlives this turn (a `delegate_task`, a takeover, a process-fix child) carries the parent and how to report to it, the setup step when it starts a fresh worktree, the waiting rule, and, when it hands over several PRs, the one-worktree-per-PR line.

Then claim the ticket and launch it. Batch independent launches in one turn. Done when every non-colliding frontier ticket within capacity has a running thread.

### Chains

A **chain** is three or more slices of one ticket, each built on the last. Give every chain one **owner** thread, which holds one slot until the chain ends (Jarred, 2026-11-13). Standalone slices, contract slices and small fixes stay one-off threads:

- **Launch once** on a chain worktree with a short build dir (`C:/cargo-targets/<chain>`), which stays warm. Each slice is a fresh branch from `origin/main` in that worktree and lands as its own PR, closing its slice ticket.
- **Between slices**, the owner writes a handoff at `.cache/chain/<ticket>.md` in its worktree (under ~60 lines: what landed, what it learned, the next slice's starting files, proposed spec changes) and reports `S<k> landed, handoff at <path>`. You take any spec changes, then send the next slice into the **same thread** with `t3_thread_send` and `freshContext: true`, so it starts a clean session on the warm worktree: "Read <handoff>, then build slice <k+1>: <spec link>." One session never spans two slices. If a fresh-context send doesn't start a clean session, fall back to `next-session` onto the same worktree, and tell your parent.
- **A blocked next slice:** the owner reports and idles; wake it when the blocker lands. A blocker longer than about half a day ends the chain early: settle it and free the slot.
- When the chain ends, settle the owner and clean up as Settling says.

## 3. Answer the children's questions

You decide for Jarred on everything but his own list. When a child sends a question or a review **decide**:

1. **On Jarred's list** (`ship`'s "Asking for a decision")? In attended mode, pass it up to your parent with your recommendation; the root asks Jarred. Tell the child it's waiting. In full send, take your recommendation and tag it `auto-accepted, to review`.
2. **Otherwise decide it** from the repo's ADRs, glossary, decision log and Jarred's past decisions. Take the child's recommendation unless you can name a reason another option is better. Run `doubt` on it first when it's hard to undo.
3. **Answer in the child's thread** with `t3_thread_send` and a new `clientRequestId` (Message ids): the choice, the reason, and the tag to record it under, `decided by <your title> for Jarred`.
4. **Log it** in the repo's decision log, in two or three lines with the ticket or PR link. Jarred vetoes by replying there.

Answer as soon as a question arrives: the child is stopped until you do.

## 4. On each report

1. **Record a resolved decision ticket**: append a context pointer (gist and link) to Decisions so far. Graduate any fog the answer made specifiable into new tickets (create, then wire), clearing it from Not yet specified. Rule out of scope anything the answer shows sits past the destination. Update or close tickets the decision invalidates; `domain-modeling` says how to fix the open ones it overrides.
2. **Forward** to running threads what they now need (a sibling's decision, a merged PR) with `t3_thread_send`, a new `clientRequestId` per message (Message ids).
3. **Retro candidates:** add them to a running list, merging each into any earlier match and noting which children hit it.
4. **Relaunch or split.** A child that stopped because its ticket outgrew its tier has already moved it up: relaunch it on the new tier, with the stopped thread's findings in the message. A ticket too big for Opus gets split. Note any lower tier a child suggests for similar tickets, and use it when charting the next ones.
5. **Launch** what the report unblocked (step 2), and any new tickets.
6. **Short of mergeable:** a PR a child left short of mergeable (a decide on Jarred's list still open, or unchecked fixes it wasn't confident in) goes to your parent, with its open items.
7. **Settle each child that reports ready to settle**, as Settling says: a build thread once its PR has landed (in ship fast, once it's in its release branch), a research or grilling thread once you have read its result, one whose ticket closed unbuilt the same way. Every other thread stays open: one with an open PR, one waiting on Jarred (`human:verify`, a held decide), one still running.

Don't relay each report up. Your parent hears from you only with a question for Jarred, a PR he must look at, or the destination.

Boundaries with other maps: message that map's thread to agree the line, ask it to copy its reply here, and record the agreed line in this map's Notes or Out of scope. When the two threads propose different lines, the root decides.

## 5. Destination

When the last ticket closes, check the map: Not yet specified is empty or moved to Out of scope. Then close the map ticket, launch the next work its decisions call for (the next map, if any), and report to your parent: what the map decided and landed, what it launched, any `to review` decisions, and your retro list. End it with your own `Ready to settle` (Settling), once every child is settled.

Done when every launch has a `threadId`, reported as `[title](t3-thread://v1/<threadId>)`.
