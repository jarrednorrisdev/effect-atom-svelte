# effect-atom-svelte

Svelte 5 bindings for Effect Atom, with a demo app and tests. The library and its documentation are in [`packages/effect-atom-svelte`](packages/effect-atom-svelte/README.md).

| Path | What |
| --- | --- |
| `packages/effect-atom-svelte` | The library. |
| `packages/demo-domain` | A todo domain served over Effect `HttpApi` and Effect RPC from one store. |
| `apps/demo-api` | The demo domain on Bun, at `:3010`. |
| `apps/demo` | An async-first SvelteKit 3 app with a page per feature, at `:5180`. |

```sh
bun install
bun run build                       # builds the library for the demo
bun run --cwd apps/demo-api dev     # in one shell
bun run --cwd apps/demo dev         # in another
```

`bun run check`, `bun run test` and `bun run lint` run across the workspace.

## Tests

`bun run test` runs the library's Vitest suite and the demo's Playwright suite. Turbo caches results, so an unchanged package replays its last result; a cached pass is trustworthy, and `--force` should not be needed.

The Playwright suite builds the demo once, then gives each worker its own demo API (`:3100` up, no latency) and `vite preview` server (`:5200` up), and resets the API's store before every test. Tests share no state, so they run in parallel and in any order. To run one: `cd apps/demo && bunx playwright test -g "<name>"`. Rebuild the library first (`bun run --cwd packages/effect-atom-svelte build`) if you changed it.

To check for flakiness, repeat tests within one run instead of looping `bun run test`, which would only replay the cache:

```sh
cd packages/effect-atom-svelte && bunx vitest run --repeats 19   # each test 20 times, ~1 min
cd apps/demo && bunx playwright test --repeat-each 20            # each test 20 times, ~2 min
```

Work is tracked in the [effect-atom-svelte project](https://linear.app/jarrednorrisdev/project/effect-atom-svelte-a13e42344ff4) in the personal Linear workspace (team JND, use the `linearis` CLI). Reference issues as `JND-<n>` in commits and changesets.
