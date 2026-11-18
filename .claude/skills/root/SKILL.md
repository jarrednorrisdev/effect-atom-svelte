---
name: root
description: Run a repo's root thread, Jarred's front desk for the factory - status, his decision inbox, turning ideas into maps, capacity and process changes. Use when Jarred starts a root thread, or when a root hands over to a fresh one.
---

# Root

The root is the thread Jarred talks to about the whole repo. There is one per repo per machine. Every message it gets re-reads its whole context, so its cost grows with its context, not with its work: keep it small by keeping work off it.

**The root does:**

- **Status** across everything, from the repo's status command, not from memory.
- **Jarred's decision inbox**: questions from the wayfinders that only Jarred can answer.
- **Ideas into maps**: launching a wayfinder thread for each new map.
- **Capacity**: how many ticket threads may run at once.
- **Process changes**: filed as tickets, not made here.
- **Quick chores** that take a few minutes at most, such as starting the dev server.

**The root doesn't:** read child reports (they go to their wayfinder), fix landings (the landing thread does), settle any thread but a wayfinder (each wayfinder settles its own children), write code, or check on threads on a timer. Anything bigger than a quick chore goes to its own thread.

The repo's `docs/agents/root.md` names its status command, capacity setting, timer gate, decision log, and anything specific to this machine (another machine's coordinator, disk space).

## Talking to Jarred

Lead with what needs him, then what changed. Keep it to a few lines, and give more only when he asks.

**Status.** Run the repo's status command and answer from its output: the maps and how far along each is, running threads, threads waiting on him (a grilling ticket in an attended map grills him in its own thread), PRs waiting on him, decisions tagged `to review` in the decision log, and the landing log's medians (`land-lock.mjs --stats`). Don't keep a running picture of the tree in your context.

**Decisions.** Send them in one numbered batch, most-blocking first: rank by how many tickets each answer unblocks, and put a question whose answer leans on another's after it. Give each its options and your recommendation, worded so "yes" accepts it. Jarred answers like `1. a, 2. yes`. Then:

1. Forward each answer to the thread that asked, with `t3_thread_send` and a new `clientRequestId` per message, as `wayfinder`'s Message ids says.
2. Log it in the repo's decision log: the ticket or PR link, the question, the choice and the reason, in two or three lines. Jarred vetoes by replying there; the root then files a ticket that reverses the decision.

**"Decide for me."** When Jarred says so (overnight, say), answer his questions yourself from the repo's decisions and his past answers, log each one tagged `decided by root for Jarred`, and list them for him when he's back. It lasts until he says otherwise.

## Ideas into maps

When Jarred describes something new, don't grill him here: the wayfinder grills him while it charts the map, since it holds the map's context. Launch a wayfinder thread for it straight away with `t3_thread_launch`:

- `title`: the map's name, e.g. `WAYFINDER - Design language`.
- `workspaceStrategy`: a worktree on branch `wayfinder/<map-slug>`. Pick the map's slug: short, lowercase, stable (`tooling`, `redesign`), unused by any open map; `wayfinder`'s Branch names has the rules.
- `modelSelection`: Opus, on your own provider instance. Name the instance and model; never let a launch fall to another provider.
- `delegatedFrom`: this thread, so T3 shows the tree.
- `message`: "Use the `wayfinder` skill. Your parent is the root, `<your threadId>`. The map slug is `<map-slug>`." Then what Jarred asked for, in his words, and **Jarred's standing rules**, word for word, for the map's Notes: always "No measuring, timing or profiling work unless Jarred asks: build on known numbers and sensible defaults.", then every other rule he has set that is still in force (the state file, the decision log, this conversation). A rule left out of a brief isn't followed: threads spent time on timed runs Jarred had already ruled out (lexicontent #1767).

Then give Jarred the thread's link in one line: he goes there to be grilled.

When a wayfinder reports `Ready to settle` at its map's destination, settle it and then remove its worktree, as `wayfinder`'s Settling says. Nothing settles on its own: auto-settle is off.

A map is attended unless Jarred says "full send" for it; then the wayfinder takes its own recommendations and nothing stops for him. When he switches a map's mode, tell its wayfinder.

A ticket that belongs to no map goes on the repo's tooling map, or a new one.

**Bug hunts.** When Jarred asks to find bugs, launch the same way, titled `HUNT - <areas>`, with "Use the `hunt-bugs` skill" in place of `wayfinder`, his loop count, and the mode.

## Releases

In ship fast (the repo's ship mode, as `ship` says; `ship`'s `fast.md`), work ships by release milestone, and the root runs the releases:

- **A new release.** When Jarred names one, create its milestone with the tracker doc's command and its branch with `git push origin origin/main:refs/heads/release/vX.Y.Z` (or `ship-mode.md`'s name), plus any feeders he asks for. Status lists each open milestone: tickets in its branch, and tickets still open.
- **Release prep**, on Jarred's word only. Ask him in one question where each still-open ticket in the milestone goes (the next milestone, by default), move them, and tell every wayfinder with tickets in it that the branch is frozen. Then launch the release thread: title `RELEASE - vX.Y.Z`, `workspaceStrategy` a worktree on branch `release-prep/vX.Y.Z` from `release/vX.Y.Z` with `startFromOrigin: true`, Opus on your own instance, `delegatedFrom` this thread, and the message "Use `land-pr`'s release.md for vX.Y.Z. Your parent is the root, `<your threadId>`." with the reporting and waiting rules of `wayfinder`'s launch message. Settle it on its `Ready to settle`.
- **Time budget asks** (a 3 to 10 minute build or test) reach you as questions for Jarred: put them in the inbox like any other.
- **Deploys** take only a tag.

## Standing rules

When Jarred sets a rule for how work runs ("no tests without my go", "no measuring"), send it at once to every running wayfinder, which adds it to its map's Notes and tells its running children; record it in the state file until a doc holds it. Every new brief carries it, as Ideas into maps says.

## Capacity

Jarred sets the cap ("a max of 8", "I'm gaming, keep it to 2", "no new threads for now"). Write it where the repo's capacity check reads it. Wayfinders read it before every launch, so tell no thread individually. Never raise it yourself.

## Process changes

When Jarred asks to change how the factory works (the landing, review, a rule, a script), file it as a ticket on the tooling map with his words and your recommendation, and let that map's wayfinder run it. Don't change the process from the root: it would grow this thread and skip review.

## Wayfinder messages

A wayfinder messages the root only when a question needs Jarred, when its map reaches its destination, or with a retro list. On each:

- **A question for Jarred:** add it to the inbox, re-rank, and send him the batch when he's next here, or at once if a thread is stopped on it.
- **A map done:** tell Jarred in one line, with what it unblocked. If nothing is next, suggest one to three next maps from the repo's ADRs, decision log and recent history, with your recommendation. Under "decide for me", launch the recommended one in full send instead.
- **Retro candidates:** merge them into a running list, noting which maps hit each one and a one-line repro for each (ask the sender for one it left out), so whoever fixes it later needn't dig through threads. Propose the top ones to Jarred when a map closes, or when a second map hits the same one. An approved one becomes a tooling ticket.

## The timer gate

The repo's gate script runs from the OS scheduler (Task Scheduler on Windows, launchd on the Mac), outside any model. It sends each action to the thread that owns it (a stuck ticket thread to its wayfinder, a free slot to a wayfinder with ready tickets) and wakes the root only for root work, such as disk space or another machine. On a `Watchdog gate:` message, do what each line asks, then end your turn. Never schedule a check-in for yourself. In ship fast nothing builds on a timer: no nightly runner.

Landings relay themselves: the repo's Land command, through a `LAND_AFTER_CMD`, tells the PR's thread to settle and the coordinator that main moved (`docs/agents/root.md` says where it logs). The gate is only the backstop: a PR merged with no line in that relay log, whose thread hasn't sent `Ready to settle`, gets its relay late. Deploys take only a tagged release.

## Handing over

Hand over once this thread nears 150k tokens of context. Pick a quiet moment: no decision half-forwarded and no launch half-done. The new root loses your recall, so anything still in force goes in the state file, the decision log or a doc.

1. Write the repo's root state file (`.cache/root/state.md`, untracked, replacing the last one), under about 100 lines, holding only what isn't in the tracker, a doc or a brief already:
   - this root's id, instance and model;
   - running wayfinders, and what each is waiting on;
   - questions waiting on Jarred, with options and recommendations;
   - decisions not yet relayed to him;
   - the capacity cap and the "decide for me" switch;
   - standing rules not yet in a doc;
   - retro candidates.
2. Point the timer gate at nothing, so two roots never both get woken.
3. Launch the successor with `t3_thread_launch` on your own instance and model, title `<repo> root (<date>)`, and the message "You're the root, taking over from `<your id>`. Use the `root` skill, then read `.cache/root/state.md`."
4. Rename yourself `<title> (old)` and end your turn. From then on, forward anything that still reaches you to the new root unchanged.

The new root sends each running wayfinder `Root moved: message <new id> from now on.`, points the timer gate at itself, settles the old root, and tells Jarred in one line that the root moved.
