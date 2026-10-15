# effect-atom-svelte

Jarred owns this library and reviews the work as the person deciding what ships. These rules come from sessions that went wrong without them.

## Working with Jarred

- **Recommend only what you'd defend.** Give your confidence with the recommendation, and the doubts you have, before Jarred asks "any qualms?". When they push back, weigh it on its merits: change your mind for a reason, not to agree.
- **Look it up before you state it.** A fact one lookup away gets looked up: the sidebar's order is `apps/demo/src/lib/docs/nav.ts`; Effect's and Atom's source is `~/Documents/repos/reference/effect`; a PR's claims are checked against its final diff.
- **Explain from the ground up.** Define each term before using it, saying where it comes from (Svelte, SvelteKit, Effect or this library). A sequence over time (server then browser, a lifecycle, a race) gets an `explainer-diagram`, not paragraphs.
- **Prototype before building.** For an example, a UI or a design choice, show a throwaway HTML prototype in chat (`html_render`) and get a yes before writing real code. Several full builds were thrown away before this rule.

## Worktrees and dev

- A new worktree needs `bun install`, then the packages built (`bunx turbo run build --filter='./packages/*'`), before `bun run dev` starts.
- Start the dev server as a background command with `timeout: 7200000`; the default stops it after 30 minutes. Site on :5180.
- The skills' scripts check the checkout they sit in, so run them from the worktree you want checked.
- `oxfmt` reflows files after edits. Re-read a file before matching its text for another edit.
- When a PR merges, remove its worktree and local branch. Keep `esa-pr-assets`: the `explainer-diagram` skill publishes PR diagrams from it.

## Pull requests

Write PR bodies with the `pr` skill, with these on top:

- **Write for the owner deciding whether to merge,** who knows Svelte and Effect but not this library's internals. Define a term or API at first use, saying where it comes from, and say what a user sees rather than naming internal functions.
- **For a bug, show the user code that hits it** (built from the PR's test fixtures) and what the user sees, then the fix as a short simplified diff. Say where a real user meets it: a docs page, or a pattern the docs teach. When nothing real reaches the bug, say so instead of inventing an app.
- **No Mermaid and no screenshots.** Where the `pr` template asks for a screenshot as evidence, show output or a test run instead. For a sequence over time, link an `explainer-diagram` step-through page, published per that skill.
- **Decisions still open go under "Needs your call",** each with the alternative and a recommendation. Once decided, they move to "Decisions".
- **Keep the body true as the PR changes:** its names, test results (with the browsers they ran in) and open decisions.

