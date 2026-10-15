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
- When a PR merges, remove its worktree and local branch. Keep `esa-pr-assets`: the `pr-description` skill publishes diagrams from it.
