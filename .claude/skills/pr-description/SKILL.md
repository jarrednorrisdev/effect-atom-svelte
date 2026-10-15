---
name: pr-description
description: Write or update a pull request description for effect-atom-svelte so its owner can follow it without knowing the code: repro and fix snippets per bug, decisions with a recommendation, and for a bug that unfolds over time, a link to an interactive step-through diagram. Use when opening a PR, rewriting a PR body, or updating one after the PR changes (hunt-bugs PRs included).
---

# PR descriptions

Jarred reads a PR as the owner deciding whether to merge, not as someone reviewing the diff line by line. Internal names (`subscribedReader`, `pendingSeed`) mean nothing until they open the code. The body has to make sense to someone who knows Svelte and Effect but not this library's internals.

## Body

In this order:

1. **One line of summary.** Add one line of background if the area needs it, such as what hydration is.
2. **One section per bug,** in two parts:
   - **The repro:** a minimal snippet of *user* code, meaning what an app author writes. Then a "**Bug:**" line saying what the user sees. Build the snippet from the PR's test fixtures so it's accurate. Say where a user meets the bug, from a real use case: a docs page or example that hits it, or a pattern the docs teach, cited. Don't invent an app to justify it; when nothing real reaches the bug, say so, since that's a reason to rank it lower.
   - **The fix:** a "**Fix:**" sentence, then a minimal *simplified* `diff` of the library change.

   Any syntax or concept a snippet relies on gets one line of explanation at first use, such as what `{#key}` does or what a scoped atom is.
3. **A diagram,** when the bug unfolds over time (see below).
4. **Tests:** a line on what each test proves, the local results with numbers, and which browsers they ran in.
5. **"Needs your call",** only for decisions still open. Each gives the alternative and a recommendation in italics.
6. **"Decisions",** once any are made: what was chosen, the alternative, and anything dropped from the PR along with why. When Jarred decides an open item, move it here. A merged PR's body is the record of why the code is the way it is.
7. **`<details><summary>Where to look in the diff</summary>`** with the files, functions and test names.
8. The footer from the system reminder.

Write every PR or issue reference as a Markdown link, every time it appears. Use they/them for Jarred. Prose stays short, and the snippets carry the explanation.

Done when someone who has never opened the code could say, for each bug, what the user saw, why, and what changed.

## Diagram

Use one when the bug unfolds over time: server then browser, a lifecycle, an ordering race. Skip it for a bug a snippet already shows completely.

1. Build it with the **explainer-diagram** skill, including its checks. The PR shows no screenshots, so skip `--key`.
2. A page's path holds the PR number, so open the PR (as a draft) before publishing.
3. Publish the page on the `pr-assets` branch, which shares no history with `main` and is never merged:

   ```sh
   # if missing: git worktree add ~/Documents/repos/jnd/worktrees/esa-pr-assets pr-assets
   cd ~/Documents/repos/jnd/worktrees/esa-pr-assets
   git pull -q
   mkdir -p pr/<number> && cp <slug>.html pr/<number>/<slug>.html
   git add pr/<number> && git commit -m "docs: <slug> diagram for #<number>" && git push
   ```

4. Pages serves it at `https://jarrednorrisdev.github.io/effect-atom-svelte/pr/<number>/<slug>.html` about a minute later. Wait until `curl -sI <url>` says `200` before linking it. A 404 that lasts: check Pages still serves the branch's root (`gh api repos/jarrednorrisdev/effect-atom-svelte/pages -q .source` gives `pr-assets` and `/`; Settings → Pages → "Deploy from a branch" to set it).
5. In the bug's section, after the fix, link it, deep-linking the step where it goes wrong. Every step has its own hash, `#before-<n>` or `#after-<n>`:

   ```md
   **[Step through the whole page load](…/pr/38/bug-2.html#before-1)**: [step 10](…#before-10) is where it goes wrong, and [the same step with the fix](…#after-10).
   ```

A diagram that explains a lasting concept, rather than this one PR, belongs in the docs site (`apps/demo`) as a deliberate docs change.

## Updating a body

Whenever the PR changes (a fix dropped, a decision made, tests added), edit the body in the same turn:
- the summary's count;
- the sections, including each simplified diff's names against the final code;
- "Needs your call" and "Decisions";
- the test numbers;
- the diagram, if the steps changed.

Before the first rewrite, back up the old body to `~/Documents/repos/jnd/scratchpad/effect-atom-svelte/pr-bodies-original/<number>.md`, then edit with `gh pr edit <n> --body-file`.

Done when every claim in the body is true of the PR as it stands: each name in a simplified diff exists in the final code, each test claim names the browsers it actually ran in after the last change, and nothing under "Needs your call" has been decided.

## Stacked PRs and history

- A PR built on another's branch says so in its first line: "Stacked on #N: merge that first."
- When a PR's history holds attempts that were replaced or reverted, say "squash-merge this one" in its body, so `main` doesn't carry them.
- Merging, including rebuilding a stacked PR after its base is squashed, follows the merge-prs skill.
