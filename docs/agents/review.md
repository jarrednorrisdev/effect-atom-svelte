# Review checklist

Checks specific to this repo, one bullet each. `review-pr` adds them to every reviewer's brief, after its general smells. Keep each to a line: what to check, and why it matters here.

- A change to `packages/effect-atom-svelte` or `packages/effect-atom-svelte-devtools` that users would notice has a changeset (`.changeset/*.md`) naming the package and the bump: CI's `changeset` job only checks that one exists, and the changelog is what users read.
- A change to the hooks, hydration or scope code has a test in `packages/effect-atom-svelte/test/` that runs in the browser project as well as the server one: the hooks depend on each engine's microtask timing, so one engine passing proves little.
- A public API change updates the docs page that teaches it (`apps/demo/src/routes/**/+page.md`) and the README snippets, and a new export has its JSDoc with `@since` and `@category` (`bun run check` enforces the tags, not the prose): the API reference is generated from them.
- A new docs page is in `apps/demo/src/lib/docs/nav.ts` (the sidebar, titles and prev/next come from it), and a component it uses is known to `apps/demo/vite/llms.ts`, or the build fails.
- Docs prose and PR text name the actual behaviour a user sees, not an internal function, and refer to issues as `#<n>`, never `JND-<n>`.
- `.claude/skills/**` copies from jnd-skills are not edited here: a local fix shows as a tweak at the next `sync.mjs`. Only `improve-docs-page` and `review-docs-site` are this repo's own.
- `.github/scripts/already-tested.sh` lists only files nothing builds or tests: a file added there that a test reads lets CI skip a test it needed.
