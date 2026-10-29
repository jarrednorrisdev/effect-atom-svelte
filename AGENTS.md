<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# effect-atom-svelte

Jarred owns this library and reviews the work as the person deciding what ships. These rules come from sessions that went wrong without them.

## Working with Jarred

- **Recommend only what you'd defend.** Give your confidence with the recommendation, and the doubts you have, before Jarred asks "any qualms?". When they push back, weigh it on its merits: change your mind for a reason, not to agree.
- **Look it up before you state it.** A fact one lookup away gets looked up: the sidebar's order is `apps/demo/src/lib/docs/nav.ts`; Effect's and Atom's source is `~/Documents/repos/reference/effect` on the Mac, and installed under `packages/effect-atom-svelte/node_modules/effect/src/` anywhere; a PR's claims are checked against its final diff.
- **Explain from the ground up.** Define each term before using it, saying where it comes from (Svelte, SvelteKit, Effect or this library). A sequence over time (server then browser, a lifecycle, a race) gets an `explainer-diagram`, not paragraphs.
- **Prototype before building.** For an example, a UI or a design choice, show a throwaway HTML prototype in chat (`html_render`) and get a yes before writing real code. Several full builds were thrown away before this rule.

## Worktrees and dev

- A new worktree needs `bun install`, then the packages built (`bunx turbo run build --filter='./packages/*'`) and `bunx svelte-kit sync` run in `apps/demo`, before `bun run dev` starts.
- Start the dev server as a background command with `timeout: 7200000`; the default stops it after 30 minutes. Site on :5180.
- The skills' scripts check the checkout they sit in, so run them from the worktree you want checked.
- `oxfmt` reflows files after edits. Re-read a file before matching its text for another edit.
- When a PR merges, remove its worktree and local branch. Keep `esa-pr-assets`: the `explainer-diagram` skill publishes PR diagrams from it.

## Pull requests

Write PR bodies with the `file-pr` skill, with these on top (where they differ from it, they win):

- **Write for the owner deciding whether to merge,** who knows Svelte and Effect but not this library's internals. Define a term or API at first use, saying where it comes from, and say what a user sees rather than naming internal functions.
- **For a bug, show the user code that hits it** (built from the PR's test fixtures) and what the user sees, then the fix as a short simplified diff. Say where a real user meets it: a docs page, or a pattern the docs teach. When nothing real reaches the bug, say so instead of inventing an app.
- **No Mermaid and no screenshots.** Where `file-pr` offers a screenshot or a Mermaid diagram, show output, a test run or a sketch instead. For a sequence over time, link an `explainer-diagram` step-through page, published per that skill.
- **Decisions still open go under "Needs your call",** each with the alternative and a recommendation. Once decided, they move to "Decisions".
- **Keep the body true as the PR changes:** its names, test results (with the browsers they ran in) and open decisions.

## Agent skills

The jnd skills read this repo's settings from `docs/agents/`. They are synced from `jnd-skills` into `.claude/skills/` (`node <jnd-skills>/scripts/sync.mjs <this checkout>`), so don't edit them here; only `improve-docs-page` and `review-docs-site` are this repo's own.

- Tracker and PRs: GitHub issues and PRs through the `gh` CLI; squash is the only merge method. See `docs/agents/issue-tracker.md`.
- Triage labels: the five default roles. See `docs/agents/triage-labels.md`.
- Domain docs and decisions: one `GLOSSARY.md` at the repo root and ADRs in `docs/adr/`, created when first needed; small decisions go in `docs/decisions.md`. See `docs/agents/domain.md`.
- Root thread: see `docs/agents/root.md`. Review checklist: `docs/agents/review.md`. High-risk areas: `docs/agents/tiers.md`. Bug hunts: `docs/agents/hunt.md`. Explainer diagrams: `docs/agents/diagrams.md`.

### Stop and ask a human before

- Merging the "chore: version packages" PR, or approving the `npm` environment's publish: either one publishes to npm.
- Deploying the docs site by hand, or changing the Cloudflare secrets or the `jnd` Alchemy profile.
- Force-pushing `main` or `pr-assets`, deleting either, or changing the repo's rulesets or merge settings.
- Filing or commenting on an issue in another project, such as Effect's: it posts publicly as Jarred.
