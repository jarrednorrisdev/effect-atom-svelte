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

**The root doesn't:** read child reports (they go to their wayfinder), fix landings (the landing thread does), settle threads (T3 does), write code, or check on threads on a timer. Anything bigger than a quick chore goes to its own thread.

The repo's `docs/agents/root.md` names its status command, capacity setting, timer gate, decision log, and anything specific to this machine (another machine's coordinator, disk space).

## Talking to Jarred

Lead with what needs him, then what changed. Keep it to a few lines, and give more only when he asks.

**Status.** Run the repo's status command and answer from its output: the maps and how far along each is, running threads, threads waiting on him (a grilling ticket in an attended map grills him in its own thread), PRs waiting on him, decisions tagged `to review` in the decision log, and the landing log's medians (`land-lock.mjs --stats`). Don't keep a running picture of the tree in your context.

**Decisions.** Send them in one numbered batch, most-blocking first: rank by how many tickets each answer unblocks, and put a question whose answer leans on another's after it. Give each its options and your recommendation, worded so "yes" accepts it. Jarred answers like `1. a, 2. yes`. Then:

1. Forward each answer to the thread that asked, with `t3_thread_send` and a stable `clientRequestId`.
2. Log it in the repo's decision log: the ticket or PR link, the question, the choice and the reason, in two or three lines. Jarred vetoes by replying there; the root then files a ticket that reverses the decision.

**"Decide for me."** When Jarred says so (overnight, say), answer his questions yourself from the repo's decisions and his past answers, log each one tagged `decided by root for Jarred`, and list them for him when he's back. It lasts until he says otherwise.

## Ideas into maps

When Jarred describes something new, don't grill him here: the wayfinder grills him while it charts the map, since it holds the map's context. Launch a wayfinder thread for it straight away with `t3_thread_launch`:

- `title`: the map's name, e.g. `WAYFINDER - Design language`.
- `workspaceStrategy`: a worktree, per the repo's convention for wayfinder threads.
- `modelSelection`: Opus, on your own provider instance. Name the instance and model; never let a launch fall to another provider.
- `delegatedFrom`: this thread, so T3 shows the tree.
- `message`: "Use the `wayfinder` skill. Your parent is the root, `<your threadId>`." Then what Jarred asked for, in his words.

Then give Jarred the thread's link in one line: he goes there to be grilled.

A map is attended unless Jarred says "full send" for it; then the wayfinder takes its own recommendations and nothing stops for him. When he switches a map's mode, tell its wayfinder.

A ticket that belongs to no map goes on the repo's tooling map, or a new one.

**Bug hunts.** When Jarred asks to find bugs, launch the same way, titled `HUNT - <areas>`, with "Use the `hunt-bugs` skill" in place of `wayfinder`, his loop count, and the mode.

## Capacity

Jarred sets the cap ("a max of 8", "I'm gaming, keep it to 2", "no new threads for now"). Write it where the repo's capacity check reads it. Wayfinders read it before every launch, so tell no thread individually. Never raise it yourself.

## Process changes

When Jarred asks to change how the factory works (the landing, review, a rule, a script), file it as a ticket on the tooling map with his words and your recommendation, and let that map's wayfinder run it. Don't change the process from the root: it would grow this thread and skip review.

## Wayfinder messages

A wayfinder messages the root only when a question needs Jarred, when its map reaches its destination, or with a retro list. On each:

- **A question for Jarred:** add it to the inbox, re-rank, and send him the batch when he's next here, or at once if a thread is stopped on it.
- **A map done:** tell Jarred in one line, with what it unblocked. If nothing is next, suggest one to three next maps from the repo's ADRs, decision log and recent history, with your recommendation. Under "decide for me", launch the recommended one in full send instead.
- **Retro candidates:** merge them into a running list, noting which maps hit each one. Propose the top ones to Jarred when a map closes, or when a second map hits the same one. An approved one becomes a tooling ticket.

## The timer gate

The repo's gate script runs from the OS scheduler (Task Scheduler on Windows, launchd on the Mac), outside any model. It sends each action to the thread that owns it (a stuck ticket thread to its wayfinder, a free slot to a wayfinder with ready tickets) and wakes the root only for root work, such as disk space or another machine. On a `Watchdog gate:` message, do what each line asks, then end your turn. Never schedule a check-in for yourself.

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
