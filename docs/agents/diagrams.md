# Explainer diagrams

What `explainer-diagram` needs to know about this repo.

- **Glossary**: `docs/diagrams/glossary.mjs`. One general definition per term; a diagram adds what's specific to it. Build with `--glossary docs/diagrams/glossary.mjs`.
- **Reference specs**: `docs/diagrams/bug-2.spec.mjs` is the bug 2 timeline from [#38](https://github.com/jarrednorrisdev/effect-atom-svelte/pull/38), Jarred's reference for "this is what good looks like". It predates the primer, so start from the skill's `examples/scope-cache.spec.mjs` (from [#41](https://github.com/jarrednorrisdev/effect-atom-svelte/pull/41), with the `graph` kind) for the primer's `terms`.
- **Real scenarios**: the docs pages (`apps/demo/src/routes/**/+page.md`) and their live examples, then the library's tests and fixtures (`packages/effect-atom-svelte/test/`). A snippet of app code is written the way those pages teach.
- **Playwright**: run the screenshot script from `apps/demo`, which depends on `playwright` (the root doesn't), after `bun install`: `cd apps/demo && node ../../.claude/skills/explainer-diagram/scripts/shoot.mjs <slug>.html <shots dir>`. Install the browser once with `bunx playwright install chromium`.

## Publishing a PR's diagram

1. A page's path holds the PR number, so open the PR (as a draft) before publishing.
2. Publish the page on the `pr-assets` branch, which shares no history with `main` and is never merged. From a worktree of that branch (`esa-pr-assets`; if missing: `git worktree add ../esa-pr-assets pr-assets`, run beside the main checkout): `git pull -q`, copy the page to `pr/<number>/<slug>.html`, commit and push.
3. GitHub Pages serves it at `https://jarrednorrisdev.github.io/effect-atom-svelte/pr/<number>/<slug>.html` about a minute later. Wait until `curl -sI <url>` says `200` before linking it. A 404 that lasts: check Pages still serves the branch's root (`gh api repos/jarrednorrisdev/effect-atom-svelte/pages -q .source` gives `pr-assets` and `/`; Settings → Pages → "Deploy from a branch" to set it).
