---
name: improve-docs-page
description: Assess and improve one page of the effect-atom-svelte docs site (apps/demo/src/routes/<page>). Covers content order, how clearly the concept is explained, whether each live example fits and proves the point, and the polish of the examples and their shown code. Use when Jarred asks to review, assess, improve or polish a docs page or example, e.g. "now the Streams page", "is this example good enough?", "assess and improve /rpc".
---

# Improve a docs page

A docs page here is a `+page.md` (mdsvex) in `apps/demo/src/routes/<page>/`. Its live examples are the `.svelte`/`.ts` files beside it. Each one is shown with `<Example files={…} hint="…">`, and readers see that source, so example code is documentation too. The kit for examples lives in `apps/demo/src/lib/docs/kit/`. Its `README.md` is the authority on which component to use for what. Read it before touching an example.

The goal is a page where a reader understands the concept from the prose and then sees it happen in the example. "It works" is not enough: if the reader can't see the mechanism, the example has failed.

For the whole site at once (repeats across pages, the sidebar's order), use the `review-docs-site` skill instead.

## Workflow

### 1. Read and look

- Read the page's `+page.md`, every example file, and the kit `README.md`.
- In `src/lib/docs/nav.ts`, find the pages just before and after this one. You need to know what the reader already knows, and what a later page covers so this one can link to it.
- Look at the page running. Start dev with `bun run dev` from the repo root: the site is on :5180 and the demo API on :3010. Run it in the background and check whether it's already up.
  - Use every example the way the hint says.
  - Check dark and light mode, a 390 px phone width and a 1280 px desktop width.
  - Watch the console for errors.
  - `scripts/shots.mjs` screenshots every example's result on a page; `scripts/shot-examples.mjs` takes whole examples, shown code included. See each file's header.
  - The scripts are in this skill's `scripts/` folder. Run them from the repo root as `bun .claude/skills/improve-docs-page/scripts/<name>.mjs`; the browser ones need `MSYS_NO_PATHCONV=1` in Git Bash.

### 2. Assess

Go through [references/rubric.md](references/rubric.md) in order:

1. Ordering
2. Concept
3. Example fit
4. Example polish
5. Shown code
6. Controls and feedback
7. Prose
8. Links

Note concrete problems only. Check [references/pitfalls.md](references/pitfalls.md) before planning anything that writes state during a load, rebuilds the library, or changes server-rendered output.

### 3. Propose, then wait

Send Jarred a numbered list of findings. Group them by example or section, and give each one:

- What's wrong, in a sentence.
- The proposed change: concrete, naming kit components, labels, durations and testids.

Then stop and wait for his reply ("go ahead", "all of it", or a subset). For a subjective visual call (color, layout), say you'll ship it as a trial commit he can revert.

If he asks a question about an example ("I don't understand the point of X"), answer it, give your recommendation, and wait again.

### 4. Implement

- Make one commit per finding, or per tight group of findings, on the current branch. Use conventional commits and no emoji.
- Don't run the test suites per change. Instead, record every e2e test the change breaks in the session notes file, if one exists, under a "Tests a change will break" heading. Give the `file:line`, the old selector or text, and what replaces it. Find them by grepping `apps/demo/e2e/` and `apps/demo/e2e-hosted/` for the example's testids, button names and texts.
- When you rename, move or remove a heading, fix the links to it, then run `bun .claude/skills/improve-docs-page/scripts/check-links.mjs`, which also checks the API reference's guide links and the READMEs.
- Keep existing `data-testid`s where the element survives. Add new testids for new outputs, named `<example>-<thing>`.
- If you rebuild `packages/effect-atom-svelte` (`bun run --cwd packages/effect-atom-svelte build`), restart dev afterwards (see pitfalls).
- If you find a library bug, don't hide it with a workaround in the example. Tell Jarred, and offer to file it on Linear with the personal `linearis` CLI, team JND.

### 5. Verify and report

- Reload the page and use each changed example.
- Check both themes and phone width, with no console errors: `scripts/check-pages.mjs /page --phone --light` reports errors and anything wider than the screen.
- Run `bun run lint` and `bun run check` before saying you're done.
- Report a short list of what changed, by example, and the tests it will break.

## Non-negotiables

- **Follow the kit's rule: fit the example, don't shoehorn.** Add a visual piece only when it shows what the section teaches.
- **Show errors with `CauseView` and types with `EffectType`.** Don't write string helpers that flatten an error.
- **Use `aria-pressed` buttons and `role="group"` button groups, not checkboxes, radios or selects.** The exception is when the checkbox _is_ the data, such as a todo's `done`.
- **Keep the shown code free of presentation noise.** Diagrams and inspectors go in separate components beside the example.
- **Make the prose and the example agree exactly.** Every claim the prose makes about behavior should be something the reader can trigger and see.
