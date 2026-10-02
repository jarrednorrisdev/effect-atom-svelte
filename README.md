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

Work is tracked in the [effect-atom-svelte project](https://linear.app/jarrednorrisdev/project/effect-atom-svelte-a13e42344ff4) in the personal Linear workspace (team JND, use the `linearis` CLI). Reference issues as `JND-<n>` in commits and changesets.
