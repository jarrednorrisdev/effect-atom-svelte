# effect-atom-svelte

Svelte 5 bindings for Effect Atom, with a docs site and tests. The library is in [`packages/effect-atom-svelte`](packages/effect-atom-svelte/README.md), and its documentation is the docs site in `apps/demo`.

| Path | What |
| --- | --- |
| `packages/effect-atom-svelte` | The library. |
| `packages/demo-domain` | A todo domain served over Effect `HttpApi` and Effect RPC from one store. |
| `apps/demo-api` | The demo domain on Bun, at `:3010`. |
| `apps/demo` | The docs site: a SvelteKit 3 app with a guide, live examples and the API reference, at `:5180`. |

```sh
bun install
bun run build                       # builds the library for the demo
bun run --cwd apps/demo-api dev     # in one shell
bun run --cwd apps/demo dev         # in another
```

`bun run check`, `bun run test` and `bun run lint` run across the workspace.

## Docs site

`apps/demo` is also the docs site. The sidebar, page titles and prev/next links come from one list, `src/lib/docs/nav.ts`. A docs page is a `+page.md` (mdsvex, laid out by `src/lib/docs/markdown-layout.svelte`). It shows a live example and that example's source with `<Example>`, imports the source with `?highlight` and uses `<Aside>` for callouts (see `src/routes/first-atom`). The RPC and HTTP API pages need the demo API, so they are only prerendered in the hosted build. Search uses Pagefind, which only indexes prerendered pages (`export const prerender = true` in `+page.ts`) and only works in a build (`vite build` then `vite preview`).

## Hosting

The docs site is deployed to `atom.jarrednorris.dev` on Cloudflare by [Alchemy](https://alchemy.run) (`apps/demo/alchemy.run.ts`): CI's `deploy` job runs `bun run --cwd apps/demo deploy` after a push to `main` passes, and skips while the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are missing. Locally, Alchemy must use the `personal` profile (`bun run --cwd apps/demo deploy`): this machine also deploys work projects with the default profile, so the stack refuses any other profile, and Cloudflare variables in the environment, outside CI. The hosted build sets `VITE_DEMO_API=in-tab`, which runs the demo API in the visitor's tab and in the build (`src/lib/in-tab-api.ts`), so every page except `/browser`, whose cookie example reads the request, is prerendered. `/browser` is rendered by the site's Worker. `bun run test` also runs `playwright.hosted.config.ts`, which builds the site that way and checks it with no demo API running.

## Tests

`bun run test` runs the library's Vitest suite, which drives real `AtomRpc` and `AtomHttpApi` clients against `@demo/domain`'s server in-process, and the demo's Playwright suite, both in Chromium, Firefox and WebKit (install them once with `bunx playwright install chromium firefox webkit`). To run one engine: `bunx vitest run --project "browser (firefox)"` or `bunx playwright test --project firefox`. Turbo caches results, so an unchanged package replays its last result; a cached pass is trustworthy, and `--force` should not be needed.

The Playwright suite builds the demo once, then gives each worker its own demo API (`:3100` up, no latency) and `vite preview` server (`:5200` up), and resets the API's store before every test. Tests share no state, so they run in parallel and in any order. To run one: `cd apps/demo && bunx playwright test -g "<name>"`. Rebuild the library first (`bun run --cwd packages/effect-atom-svelte build`) if you changed it.

To check for flakiness, repeat tests within one run instead of looping `bun run test`, which would only replay the cache:

```sh
cd packages/effect-atom-svelte && bunx vitest run --repeats 19   # each test 20 times per engine, ~2.5 min
cd apps/demo && bunx playwright test --repeat-each 20            # each test 20 times per engine, ~8.5 min
```

Work is tracked in the [effect-atom-svelte project](https://linear.app/jarrednorrisdev/project/effect-atom-svelte-a13e42344ff4) in the personal Linear workspace (team JND, use the `linearis` CLI). Reference issues as `JND-<n>` in commits and changesets.
