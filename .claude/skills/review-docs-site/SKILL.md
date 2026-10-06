---
name: review-docs-site
description: Review the effect-atom-svelte docs site as a whole, then plan, make, test and ship the changes. Covers which pages, sections and examples earn their place, which repeat each other, which sit on the wrong page or in the wrong order (sidebar and within pages), and how much code pages show. Use when Jarred asks about the whole site rather than one page, e.g. "take a step back and look at the docs", "are any examples duplicates?", "is the sidebar in the right order?".
---

# Review the docs site

The site is `apps/demo`: one `+page.md` per page in `apps/demo/src/routes/<page>/`, in the order of `apps/demo/src/lib/docs/nav.ts`, each with live examples beside it. One page at a time is the job of the `improve-docs-page` skill (`.claude/skills/improve-docs-page/`); this skill looks across pages, and reuses that skill's rubric, pitfalls and scripts. Its scripts are referred to below as `scripts/…`, meaning `.claude/skills/improve-docs-page/scripts/`.

## 1. Read everything

- Read every `+page.md` in full, in sidebar order. Done when you can name, for each page, its sections and its examples.
- Read the source of every example that looks like another page's, and the kit `README.md`.
- `bun scripts/code-size.mjs` lists how much example source and snippet code each page shows.
- Start dev from the repo root in the background, with the longest timeout allowed (`bun run dev`; site on :5180). A background task stops at its time limit: when a page stops loading, start dev again.
- Look at the examples: `scripts/shots.mjs` shoots every result on the site, and `scripts/shot-examples.mjs` a page's whole examples, code included. See each file's header.

## 2. Assess

Go through [references/site-rubric.md](references/site-rubric.md). Done when every page in `nav.ts` has been checked against every item, order within the page included. Keep that per-page check in the notes file (step 4), so a skipped page shows.

## 3. Propose, then wait

Send Jarred numbered findings, grouped by the questions he asked. For each: what's wrong in a sentence, and the change. For a repeat, say which example stays as the canonical one and what the others become. Then wait.

He will come back with questions ("where should X go?", "do these justify their own page?"). Answer each with a recommendation, and keep the numbering going so he can approve "all of #1–39". When he asks whether you did something, say exactly how far you went, then finish it.

## 4. Plan

- Work alone, on one branch off `main` (`git switch -c <name>`). Parallel threads would conflict on the files every chunk touches (`nav.ts`, `example.svelte`, the e2e tests, links between pages), and speed is not the goal.
- Write the plan to a notes file outside the repo, `D:/Code/eas-notes/<name>.md`, with:
  - chunks: navigation and shared components first, then one chunk per sidebar section, Guides last;
  - one checkbox per finding;
  - "Anchors changed" (old → new, and where the new one must be created);
  - "Tests a change will break".
- If Jarred asked for the work as well as the plan, start straight after writing it.

## 5. Implement, chunk by chunk

Follow step 4 of `improve-docs-page` (one commit per finding, no test runs, record broken tests). Also:

- Grep both `apps/demo/e2e/` and `apps/demo/e2e-hosted/` for every testid, button name and text you change.
- When a heading moves or goes, record its anchor, and fix its links in the same commit.
- Write multi-line edits as script files (Write a `.py` or `.mjs`, then run it). A heredoc in Bash breaks on the apostrophes docs prose is full of.
- To reorder a page, split it on `## ` headings and put the sections back together in the new order. A heading's anchor doesn't depend on its level, so promoting `###` to `##` keeps links working.
- After each chunk, load what you changed: `scripts/shot-examples.mjs`, or `scripts/check-pages.mjs /page,/page`.

## 6. Sweep, then hand over

- `bun scripts/check-links.mjs`: every page and section link, the API reference's guide links, and the READMEs.
- `scripts/check-pages.mjs`, then with `--phone --light`. Report wide pages you didn't cause as found, not fixed.
- `bun run format`, `bun run lint`, `bun run check`. `check` restores the library build, so restart dev afterwards.
- Report by area: what changed, the judgment calls Jarred should look at, and anything you found but left alone. Ask him to review it on :5180.

## 7. Ship, once Jarred is happy

1. Fix the tests on the "Tests a change will break" list.
2. `bun run --cwd apps/demo test` runs vitest, the e2e suite in Chromium, Firefox and WebKit, then the hosted config, and stops at the first stage that fails. Run the rest yourself: `bunx playwright test -c playwright.hosted.config.ts` from `apps/demo`.
3. Rerun every failure with `bunx playwright test <file:line> … --repeat-each 3`. A test that fails again is yours to fix. One that passes every time is a timing flake: say so, and name it.
4. Push, open the PR with `gh pr create`, then link it and watch it with T3 Code's `link_pull_request` and `watch_pull_request`.
5. When every check passes, `gh pr merge <n> --merge`, then update local `main`.
6. Pushing to `main` deploys the site, but only after `check`, `e2e` and `hosted` pass on `main` too. If one flakes, the deploy is skipped: `gh run rerun <run id> --failed`, wait, then curl the live site for a phrase from the change.
