---
name: review-pr
description: Review a PR in at most two adversarial rounds on the ticket's tier, fixing clear defects and handing design decisions to the parent thread. Every PR runs it before it lands. Mergeable at 5/5, or at 4/5 when every remaining finding is a nit you handled.
---

Review rounds until a round finds no **fix**, at most two, then hand the PR back to `ship` to land if it's mergeable: Jarred has delegated review to this process. You are the **author**: each reviewer only reports, and you make every change. The repo's `docs/agents/` names its review commands, when it has them: rendering the brief and posting the review comment. Without them, do those steps by hand as below.

## 1. Choose the reviewer's tier

Every round runs on the PR's ticket tier (its `model:*` label), with Sonnet as the floor: a PR with no ticket, or a Haiku ticket, is reviewed on Sonnet. Raise it to Opus when the diff touches an area in the repo's `docs/agents/tiers.md` "Review on Opus" list. Later rounds keep the tier and never step down.

Write down the tier and a one-line reason; the review comment states both.

## 2. Dispatch a reviewer

Start one fresh reviewer per round, with the brief in `brief.md` beside this skill, its placeholders filled in. Write the filled brief to `.cache/review-brief-<pr>-r<n>.md` (one per round, so a stale brief can't pass for this one), or use the repo's command that renders it. Fill `{{read_commands}}` from the repo's tracker doc, `{{smells_path}}` with the absolute path of `smells.md` beside this skill, and `{{repo_checklist}}` with the bullets in the repo's `docs/agents/review.md`, or drop that line when there is none.

There is no merge of `main` before a round: the landing merges it. A conflict is fixed before a round is spent: `git fetch origin && git merge origin/main`, commit and push.

**Round 1 is a full review. Round 2 is a delta**: the PR's own change since the last reviewed sha, `git diff <last reviewed sha> HEAD -- $(git diff --name-only origin/main...HEAD)`, plus the open findings with your responses and the last reviewer's map. When that file list is empty, the delta is empty: skip the diff, since with no path git diffs the whole range. Make round 2 a full review instead when the commits since round 1 add up to more than about 300 changed lines.

When the PR closes no ticket, write the spec yourself into the brief: what Jarred asked for, in his words where you have them, or the handoff the work came from.

How to start the reviewer:

- `delegate_task`, not the Agent tool, since the reviewer needs its tier's effort: `role: "review"`, `mode: "wait"`, a `timeoutMs` of 900000, the tier's model and effort as `target`, and a new `clientRequestId` per round. Leave `providerInstanceId` out on purpose: the reviewer then runs on the Claude instance your own thread runs on, with no `orchestrator_capabilities` call (about 10k tokens).
- **Pass the brief by file.** The task is one opening line (`Sonnet tier (claude-sonnet-5-5), full review.`), the reason for the tier, and `Read <absolute path> and follow it.` Paste the brief's text only for a reviewer that reports it can't read the file.
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

The PR carries one review comment, rewritten each round from the latest report and every round's fixes, in the shape `comment.md` gives. Use the repo's review-comment command when it has one; otherwise render it by hand and post it as `comment.md` says. The step is done when the PR's one `<!-- review-pr -->` comment shows this round's footer.

## 5. Loop

Take the first rule that matches:

- **decide findings open**: post this round's comment first. Send each decide to your parent thread as `ship` says, with the reviewer's options and recommendation and yours, and end your turn. In a full send, take the reviewer's recommendation unless it's on Jarred's list. Once answered, make the changes as in step 3, update every doc that states the old behaviour in the same commit, and add the decide to the comment's Fixed rows, tagged `decided by <who> for Jarred` when Jarred didn't decide it. Then take the next rule that matches.
- **No fix findings, or only nits**: the PR is mergeable, whether the score is 5 or held at 4 by nits you made or rebutted. Never run another round just to see 5/5. Hand back to `ship` to land.
- **Every fix changed no behaviour** (a correction to the PR body, the review comment, a comment or doc wording): mergeable, with no new round. Record them in the Fixed rows, raise the subscores they held down, and re-render the comment so it reads mergeable.
- **This was round 1 and a fix changed behaviour**: go back to step 2 for a delta round.
- **This was round 2 and it found fixes**: there is no round 3. Make every fix and nit. If each is small and you're confident in it, mark the PR mergeable and name, in the comment's verdict, the fixes no reviewer has checked. Otherwise send the PR to your parent as a decide (land with the unchecked fixes, or one more round) with your recommendation, and end your turn.

## Other comments on the PR

Any other comment you post opens with `> [!NOTE]` and `> 🤖 **<model> responding on behalf of Jarred**`, then the reply: conclusion first, citing the code or check, no filler. Check it for secrets before posting.
