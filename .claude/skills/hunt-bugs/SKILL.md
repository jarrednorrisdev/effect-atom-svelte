---
name: hunt-bugs
description: Run the bug-hunting loop on a repo as a hunt map: hunt with parallel agents, prove each bug with a failing test, verify it adversarially, then file the survivors as build tickets that wayfinder launches and ship lands. Use when Jarred asks to find bugs, harden the tests, audit the code, or run the bug loop.
---

# Hunt bugs

This thread is the coordinator of a **hunt map**: follow `wayfinder` for the map, its mode, launching, answering and reports. This skill replaces wayfinder's charting with a loop: hunt, verify, file. The fixes are ordinary build tickets, so `ship` fixes, reviews and lands them.

A finding counts only once a **red** test proves it: a test that fails on `main` for the reason claimed.

The repo's `docs/agents/hunt.md` holds what's specific to it: the **areas** (code paths, and the questions that found bugs before), the command that runs one test, where the code's **promises** live (docs, API comments, README), and anything a hunter must know (a comparable library to check behaviour against, upstream code the repo inherits). Without it, stop and ask Jarred to write it, or `setup-jnd` to draft it.

## 0. Start

Create the map (Destination: "no unreported bug in `<areas>` survives a loop", Notes: the mode and the loop count Jarred gave), or adopt the open one. Build the **known list** every brief carries, so hunters don't find the same bug again: the map's open tickets, its Out of scope lines (findings already rejected), open PRs, and recent `fix` commits (`git log --oneline origin/main | grep -i fix`).

## 1. Hunt

Start one hunter per area in parallel (the Agent tool, `model: "sonnet"`, worktree isolation, several calls in one message), with the brief in [hunter-brief.md](hunter-brief.md). Pick the areas earlier loops covered least. From the second loop on, one hunter reviews the fixes the earlier loops landed instead: fixes are the likeliest place for new bugs.

## 2. Verify

A hunter's failing test is a claim, not a verdict. For each area with findings, start one reviewer on Sonnet told to disprove each one. A finding survives only if:

- the behaviour it expects is one of the code's promises;
- the comparable library doesn't behave the same way (if it does, it's probably intended: fix the docs, not the code);
- it isn't upstream behaviour the repo inherits;
- the scenario is one a real user reaches.

Re-run a sample of the red tests yourself. Sort the survivors into fix, docs-only, upstream, or not a bug. Done when every finding has a verdict with its reason.

## 3. File

- **Fix and docs-only:** one build ticket per area, holding every surviving finding in it: the scenario, observed against expected, the promise it breaks (quoted), and the red test in a code block, to land in the area's existing test file named by the behaviour it checks. Acceptance: each test fails without the fix and passes with it. Wire a blocker between two tickets that touch the same lines.
- **Upstream:** a task ticket to work around it cleanly if possible, with a drafted upstream issue and a minimal repro. Filing upstream posts publicly as Jarred: it's on his list.
- **Not a bug:** one line in the map's Out of scope, with the reason, so later loops skip it.

A product call (a behaviour change users would notice, a public API's shape) goes to Jarred as `wayfinder`'s step 3 says. Then launch the frontier per `wayfinder`.

## 4. Repeat

Start the next loop at step 1 once this loop's tickets are launched; don't wait for them to land. Stop when the loop count is reached, when a loop finds nothing that survives verification, or when Jarred says. Then finish the map per `wayfinder`'s Destination step, reporting each loop's findings, tickets and verdicts.
