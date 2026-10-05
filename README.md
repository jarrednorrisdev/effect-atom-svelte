# effect-atom-svelte

Community-built Svelte 5 bindings for Effect Atom, with a docs site and tests. It is not affiliated with Effect or the Effect team. The library is in [`packages/effect-atom-svelte`](packages/effect-atom-svelte/README.md), and its documentation is the docs site in `apps/demo`, live at [atom.jarrednorris.dev](https://atom.jarrednorris.dev).

**Status:** pre-release. The package isn't on npm yet, and this repository stays private until it goes public. It targets `effect` 4.0 (`~4.0.0`), Svelte 5.57+ with `experimental.async`, and SvelteKit 3.

```svelte
<!-- src/routes/+layout.svelte: one registry for the app -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

```svelte
<!-- counter.svelte: every counter shares one count -->
<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  const count = useAtom(countAtom);
</script>

<button onclick={() => (count.current += 1)}>Clicked {count.current} times</button>
```

[Installation](https://atom.jarrednorris.dev/installation) covers the Svelte options and the rest of the setup.

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

`bun run check`, `bun run test` and `bun run lint` run across the workspace. [CONTRIBUTING.md](CONTRIBUTING.md) covers the docs site, hosting, the tests and how work is tracked.
