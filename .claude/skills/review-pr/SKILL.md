---
name: review-pr
description: "Review a PR in up to three adversarial Opus 5.5 rounds, fixing clear defects and handing design decisions to a human."
disable-model-invocation: true
---

Review rounds until a round finds no **fix**, at most three, so the PR is at its best before Jarred reviews it themselves. You are the **author**: each reviewer only reports, and you make every change.

## 1. Dispatch a reviewer

Start one reviewer on Opus 5.5 at medium effort, with the brief below and its placeholders filled in. Each round is a fresh reviewer. From round 2, paste every earlier finding with your response (the commit that fixed it, or your rebuttal), the head sha the last reviewer read, and the last reviewer's context for the next round into the brief. When the PR names no GitHub issue, write the spec yourself: what Jarred asked for, in their words where you have them, or the handoff or brief the work came from.

- In T3 Code: `delegate_task` with `target: { providerInstanceId: "claudeAgent", model: "claude-opus-5-5", options: { effort: "medium" } }` and a new `clientRequestId` per round.
- In Claude Code outside T3: the `Agent` tool with model `opus` and effort `medium`.

Wait for its report. The step is done when you hold the report.

## 2. Act on the report

- **fix**: make the fix, or rebut it in one line when the finding is wrong.
- **nit**: make it, or rebut it in one line.
- **decide**: leave the code as it is; these are for Jarred, in step 4.

When you changed anything, run `bun run fix`, `bun run lint` and `bun run check`, commit and push. CI runs the test suites on the PR; don't run them locally first. The step is done when every **fix** and **nit** is either fixed in a pushed commit or rebutted.

## 3. Update the review comment

The PR carries one review comment, rewritten each round from the latest report and every round's fixes:

````markdown
<!-- review-pr -->

## Confidence Score: <score>/5

**[<impact> impact]** <the reviewer's one-line verdict>

| Subscore       | Score         | Why      | To reach 5                     |
| -------------- | ------------- | -------- | ------------------------------ |
| Spec           | <dot> <score> | <reason> | <the change that gets it to 5> |
| Design         | <dot> <score> | <reason> | <the change that gets it to 5> |
| Implementation | <dot> <score> | <reason> | <the change that gets it to 5> |
| Stability      | <dot> <score> | <reason> | <the change that gets it to 5> |
| Security       | <dot> <score> | <reason> | <the change that gets it to 5> |

### Decisions

1. **<finding>** (<axis>, [`path:line`](https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<line>)): <options>. Recommended: <option>.

### Summary

<the reviewer's summary>

<details>
<summary>Fixed (<count>)</summary>

| Round | Axis   | Finding   | Resolution                   |
| ----- | ------ | --------- | ---------------------------- |
| <k>   | <axis> | <finding> | <commit>, or rebutted: <why> |

</details>

<sub>Round <k> · Reviewed by Opus 5.5 at medium effort · reviewed at <the head sha the reviewer read></sub>
````

The dot is 🟢 for 5, 🟡 for 4, 🟠 for 3 and 🔴 for 2 or 1, and ⚪ for n/a. Leave a "To reach 5" cell empty at 5 or n/a, and drop the column when every subscore is 5 or n/a. Link each `path:line` to the head sha the reviewer read, where its line numbers come from. Escape `|` as `\|` inside a table cell. Drop a section that has nothing in it. Write the body to a file, then update the comment, or post it in round 1:

```sh
id=$(gh api "repos/{owner}/{repo}/issues/<n>/comments" --paginate --jq '.[] | select(.body | startswith("<!-- review-pr -->")) | .id' | head -1)
if [ -n "$id" ]; then gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$id" -F body=@<file>; else gh pr comment <n> --body-file <file>; fi
```

The step is done when the PR's one `<!-- review-pr -->` comment shows this round's footer.

## 4. Loop

Take the first rule that matches:

- **decide findings open**: stop. End your reply with them under "Decisions for you", each linked to the PR, with your recommendation, then make the changes as in step 2 once Jarred answers and go back to step 1, unless that was round 3: then stop and tell Jarred that those changes and this round's fixes are unchecked.
- **No fix findings in this round**: done, whether the score is 5 or held at 4 by nits you made or rebutted. Tell Jarred the PR is ready for their review.
- **This was round 3**: stop. Tell Jarred which fixes from this round no reviewer has checked yet.
- **fix findings in this round**: go back to step 1.

## Reviewer brief

> You are an adversarial reviewer of PR #<n> in this repo, checked out at `<worktree path>`; read files there. Hunt hard for defects that would break behaviour or mislead whoever builds from the PR, and report that nothing survived when that is the truth. You review only: leave the checkout exactly as you found it, on its branch with no checkout, commit or stash, and push nothing. To read another commit, use `git show <sha>:<path>`.
>
> In round 1, read the diff with `gh pr diff <n>`, the PR body with `gh pr view <n>`, and its spec: the GitHub issue it names, read with `gh issue view <n> --comments`, or else the spec below. Read `.claude/CLAUDE.md` and `CONTRIBUTING.md`, and every doc they point at that bears on the diff. Read the surrounding code, not only the hunks.
>
> Scope: in round 1, review the whole PR. From round 2, review only the branch's own commits since the last round, `git log -p --first-parent --no-merges <last reviewed sha>..HEAD`, and the text around them, and check each earlier fix landed; an earlier round already covered the rest. Read the new commits against the map from the last round, and open other files, the ticket or docs only where a commit touches them. List the merge commits in that range with `git log --first-parent --merges --format=%h <last reviewed sha>..HEAD`, and check each with `git show --cc <sha>` for changes made while resolving a conflict.
>
> Review every file in the diff through the lens for its kind.
>
> **Code**: bugs and unhandled cases, behaviour the spec asked for that is missing or wrong, behaviour nobody asked for, breaches of the repo's documented standards (skip what lint and typecheck enforce), missing or hollow tests, and migrations that are not additive. Match the diff against the smell baseline in step 3 of `.claude/skills/code-review/SKILL.md`; a smell is always a **nit** or **decide**.
>
> **Libraries**: for every external library API the diff calls (Effect and Effect Atom, Svelte, SvelteKit and the rest), read the source and the official docs and check the diff against them: Effect's and Atom's source is cloned at `~/Documents/repos/reference/effect`, and the installed versions are under `node_modules/.bun`. Look for: a hand-rolled helper where the library already ships one, such as a retry loop beside `Schedule` or a manual cache beside `Cache`; a deprecated or legacy API beside its replacement; a non-idiomatic pattern the library's own source and docs avoid; and wasted work, such as sequential calls that could run concurrently or rebuilding a layer per request. Quote the library source or doc line in each finding. These score on Implementation, or on Design when the better route changes the approach.
>
> **Docs**: claims that contradict the code, the library's JSDoc or another docs page; decisions stated without the options they rejected, or open questions written as settled; what the spec asked for that the doc leaves out. Check docs an agent reads against `.claude/skills/writing-for-agents/SKILL.md`, and pages of the docs site (`apps/demo/src/routes`) against `.claude/skills/improve-docs-page/SKILL.md`. Report wording only when it changes what a reader would build or believe.
>
> Verify every finding before you report it: read the code path through, or run the test or command that shows it. Drop what you cannot verify.
>
> Report each finding as: label, axis, `path:line`, the defect in one sentence, and the concrete inputs or state that make it fail. Label each one:
>
> - **fix**: a clear defect with one right fix.
> - **decide**: several reasonable fixes, or it changes an interface, schema, scope or product behaviour, or the spec is ambiguous. Give the options and your recommendation.
> - **nit**: optional polish.
>
> Most severe first, under 500 words. If nothing survives verification, say so.
>
> Open the report with:
>
> - **Subscores**, each 1 to 5 for the PR as it stands, with a one-line reason; for every subscore below 5, add the change that would get it to 5, naming the findings behind it. On every axis: 5 nothing open, 4 only **nit** findings, 3 **fix** findings, 2 **decide** findings, 1 wrong approach, do not merge. A fix big enough to want its own review is a **decide**. Tag each finding with its axis.
>   - **Spec**: does it do what the spec asked, without gaps or extra scope?
>   - **Design**: are the choices behind it the best routes? Mark it down only for a concrete alternative you can name and argue is better, raised as a **decide**. A choice Jarred has already decided scores 5.
>   - **Implementation**: is the design built correctly, cleanly and composably, and does it scale? On a docs PR: is it clear and consistent?
>   - **Stability**: is it unlikely to cause bugs or unexpected behaviour, with tests that would catch them? On a docs PR: does it contradict the code or another doc?
>   - **Security**: is it unlikely to open a security hole, leak a secret or weaken a guardrail? Write n/a when the PR has no security surface.
> - **Confidence score**: the lowest subscore, with n/a counting as 5. Add the impact (Low, Medium or High: how much breaks if you are wrong) and a one-line verdict.
> - **Summary**: what the PR changes, in two to four bullets in the repo's domain language.
>
> End the report with **Context for the next round**, under 200 words: the PR's shape, the invariants it relies on, the risky areas and the files that hold them, and which parts you read in full. Describe the PR; keep verdicts in the findings.
>
> Earlier rounds name findings already raised, with the author's response. Raise a rebutted finding again only when you can show the rebuttal is wrong, and check each claimed fix landed.
>
> Spec, when the PR names no issue: <spec>
>
> Earlier rounds: <findings and responses, and the last reviewed sha, or "none">
>
> Context from the last round, a map of the whole PR to read the new commits against; form your own view of everything it describes: <the last reviewer's context for the next round, or "none">
