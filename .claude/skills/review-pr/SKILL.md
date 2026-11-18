---
name: review-pr
description: Review a PR in at most two adversarial rounds on the ticket's tier, fixing clear defects and handing design decisions to the parent thread. Every PR runs it before it lands. Mergeable at 5/5, or at 4/5 when every remaining finding is a nit you handled.
---

Review rounds until a round finds no **fix**, at most two (or the repo's review budget, below), then hand the PR back to `ship` to land if it's mergeable: Jarred has delegated review to this process. You are the **author**: each reviewer only reports, and you make every change. The repo's `docs/agents/` names its review commands, when it has them: rendering the brief and posting the review comment. Without them, use the scripts beside this skill.

## 1. Choose the reviewer's tier

Every round runs on Opus at medium effort, whatever the ticket's tier (`wayfinder`'s `tiers.md`): review is judgement work. Later rounds keep round 1's tier and never step down from it.

A repo can trade review depth for speed in its `docs/agents/review.md`, under **Review budget**: the kinds of diff that get one round instead of two, and the kinds that get **no reviewer**. Follow it when it's there. With no reviewer, check the diff yourself against the repo's checklist, post a one-line review comment (`<!-- review-pr -->`, "No reviewer: <the budget rule>; self-checked against the checklist"), and hand back to `ship` to land. In ship fast (`ship`'s `fast.md`) the review is the gate, since nothing builds a ticket before its release: every PR gets at least one reviewer round, whatever the budget says.

Write down the tier and a one-line reason; the review comment states both.

## 2. Dispatch a reviewer

Start one fresh reviewer per round, with `brief.md` beside this skill filled in for the round. Render it after pushing, from the PR's worktree:

```sh
node <this skill's folder>/render-brief.mjs [--pr <n>] --round <k> --tier <tier> [--base <branch>] [--extra-diff <file>] [--since <last reviewed sha>] [--full] [--spec-file <file>] [--notes-file <file>] [--earlier-file <file>]
```

`--tier` takes a tier name from `wayfinder`'s `tiers.md` (`opus` for every round here). Pass `--base` with the PR's base when it isn't `main`: in ship fast, a ticket's release branch. Leave out `--pr` for a branch with no PR; its files are then keyed `branch-<branch>`. Pass `--extra-diff` with a diff that ships with this work but isn't in it, such as a jnd-skills half, so the reviewer reviews it too. In ship fast the brief also has the reviewer check what a compiler would, across this PR and the unbuilt tickets it builds on. It writes `.cache/review-brief-<pr>-r<k>.md` (one per round, so a stale brief can't pass for this one), fills the repo's Read commands, checklist and the smells path, tells the reviewer to skip vendored files, deletes a stale report, and takes the last round's context from its report. It refuses a checkout with uncommitted changes or an unpushed head, and a round above 1 with no earlier findings: pass `--earlier-file`, or keep the Fixed rows in `.cache/review-fixed-<pr>.json`, which it reads when that file exists. The repo's own command, when it has one, does the same.

There is no merge of `main` before a round: the landing merges it. A conflict is fixed before a round is spent: `git fetch origin && git merge origin/<base>`, commit and push.

**Round 1 is a full review. Round 2 is a delta**: the PR's own change since the last reviewed sha, `git diff <last reviewed sha> HEAD -- $(git diff --name-only origin/<base>...HEAD)`, plus the open findings with your responses and the last reviewer's map. When that file list is empty, the delta is empty: skip the diff, since with no path git diffs the whole range. Make round 2 a full review instead when the commits since round 1 add up to more than about 300 changed lines.

**Waivers go on the ticket.** The reviewer reads the ticket and the PR, never the threads: a waiver, scope cut or answer given only in a thread is invisible to it, and the Spec axis marks the work down for it (lexicontent PR 1822 scored Spec 2/5 on one). Before rendering, comment each one on the ticket, naming who gave it, or put it in the PR body.

When the PR closes no ticket, write the spec yourself and pass it with `--spec-file`: what Jarred asked for, in his words where you have them, or the handoff the work came from.

How to start the reviewer:

- `delegate_task`, not the Agent tool, since the reviewer needs its tier's effort: `role: "review"`, `mode: "wait"`, a `timeoutMs` of 900000, `target: {"model": "claude-opus-5-5", "options": {"effort": "medium"}}`, and a new `clientRequestId` per round. `model` and `options` sit directly on `target`: `delegate_task` silently ignores a `t3_thread_launch`-style `modelSelection` and runs the reviewer on your own thread's model (#303's review ran on Sonnet that way). Leave `providerInstanceId` out on purpose: the reviewer then runs on the Claude instance your own thread runs on, with no `orchestrator_capabilities` call (about 10k tokens).
- **Check the model that ran.** The result's `executedModel` must be `claude-opus-5-5`. If it isn't, the round doesn't count: dispatch it again with the `target` above, under the round's id plus `-opus`.
- **Pass the brief by file.** The task is one opening line (`Opus tier (claude-opus-5-5, medium effort), full review.`), the reason for the tier, and `Read <absolute path> and follow it.` Paste the brief's text only for a reviewer that reports it can't read the file.
- **The report file.** The brief tells the reviewer to write its whole report to `.cache/review-report-<pr>-r<n>.md`, as an absolute path in your checkout, and to answer with one line naming it, so you never re-emit the report. Delete a file left at that path by an earlier dispatch of the round first.
- On a rate or usage limit, retry once on another Claude instance named in `providerInstanceId`, under the round's id plus `-fallback`.

Hold every change to the PR until the report arrives: the reviewer reads this checkout.

If the wait times out, end your turn; the completion notice wakes you. Never poll. A reviewer stuck on a permission prompt (`task_status` shows `pendingApproval`) gets cancelled and the round dispatched afresh.

The step is done when you hold the report.

## 3. Act on the report

- **fix**: make the fix, or rebut it in one line when the finding is wrong.
- **nit**: make it, or rebut it in one line.
- **decide**: leave the code as it is until it's answered in step 5.

When you changed code, commit and push, and record what you ran under "Checks run" in the PR body. The step is done when every **fix** and **nit** is either fixed in a pushed commit or rebutted.

## 4. Update the review comment

The PR carries one review comment, rewritten each round from the latest report and every round's fixes, in the shape `comment.md` gives. Use the repo's review-comment command when it has one (the repo's `docs/agents/review.md` names it and its flags); otherwise render it with `node <this skill's folder>/render-comment.mjs --pr <n> --round <k> --report <report> --tier <tier> --reason "<tier reason>" [--fixed <rows file>] [--verdict "<line>"] [--raise <Axis>=<score>]` and post it as `comment.md` says. The script writes the body to `.cache/review-comment-<pr>.md` and prints only that path: post the file, never the script's output. Keep every round's Fixed rows in one JSON array (`.cache/review-fixed-<pr>.json`), one row per finding: `{"round": 1, "axis": "Implementation", "finding": "...", "resolution": "<commit>, or rebutted: <why>", "nit": true}` (`nit` only on nits). After fixes that changed no behaviour, `--raise <Axis>=5[:<why>]` lifts each subscore they held down and replaces its Why. The step is done when the PR's one `<!-- review-pr -->` comment shows this round's footer.

## 5. Loop

Take the first rule that matches:

- **decide findings open**: post this round's comment first. Send each decide to your parent thread as `ship` says, each under a new `clientRequestId`, with the reviewer's options and recommendation and yours, and end your turn. In a full send, take the reviewer's recommendation unless it's on Jarred's list. Once answered, make the changes as in step 3, update every doc that states the old behaviour in the same commit, and add the decide to the comment's Fixed rows, with the report's `finding` text copied exactly (`render-comment.mjs` closes a decision whose finding has a Fixed row), tagged `decided by <who> for Jarred` when Jarred didn't decide it. Then take the next rule that matches.
- **No fix findings, or only nits**: the PR is mergeable, whether the score is 5 or held at 4 by nits you made or rebutted. Never run another round just to see 5/5. Hand back to `ship` to land.
- **Every fix changed no behaviour** (a correction to the PR body, the review comment, a comment or doc wording): mergeable, with no new round. Record them in the Fixed rows, raise the subscores they held down (`--raise`), and re-render the comment so it reads mergeable.
- **This was round 1 and a fix changed behaviour**: go back to step 2 for a delta round.
- **This was round 2 and it found fixes**: there is no round 3. Make every fix and nit. If each is small and you're confident in it, mark the PR mergeable and name, in the comment's verdict, the fixes no reviewer has checked. Otherwise send the PR to your parent as a decide (land with the unchecked fixes, or one more round) with your recommendation, and end your turn. This cap overrides any brief that asks for a delta review of every later commit: a round-2 nit is fixed or rebutted, never re-reviewed, and only a fix that is more than a nit can earn the extra round, through that decide.
- **A nit that adds error recovery around a third-party library**: read the library's own recovery semantics (its source in `node_modules` or the crate) before fixing it; a guessed recovery call can regress what worked (#367's hls.js `startLoad`).

## Other comments on the PR

Any other comment you post opens with `> [!NOTE]` and `> 🤖 **<model> responding on behalf of Jarred**`, then the reply: conclusion first, citing the code or check, no filler. Check it for secrets before posting.
