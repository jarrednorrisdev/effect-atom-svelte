# effect-atom-svelte

Svelte 5 bindings for Effect Atom (`effect/reactivity`): hooks with a reactive `current`, async atoms you can `await` in markup, and server rendering with hydration. The API follows `@effect/atom-react`.

This is a community project by Jarred Norris. It is not part of Effect, and the Effect team neither makes nor endorses it. Most of its code and docs were written with the help of AI (Claude Opus 5.5); its behavior is covered by tests in Chromium, Firefox and WebKit.

**Documentation: [atom.jarrednorris.dev](https://atom.jarrednorris.dev)** · [API reference](https://atom.jarrednorris.dev/reference) · [GitHub](https://github.com/jarrednorrisdev/effect-atom-svelte)

## Requirements

- `effect` 4.0.x. The peer range is `~4.0.0`, not `^4.0.0`: the bindings use parts of the atom registry that aren't public API, which a minor release of `effect` can change.
- Svelte 5.57.2 or later. `experimental.async` is needed for `useAtomSuspense`, `useAtomResult` and server rendering.
- SvelteKit is optional. The docs site and its tests run on SvelteKit 3. On SvelteKit 2, the error hooks in `effect-atom-svelte/sveltekit` work with less detail, and reach `<svelte:boundary>` only with `kit.experimental.handleRenderingErrors` turned on.

## Installation

```sh
npm install effect-atom-svelte "effect@~4.0.0"
```

Turn on Svelte's async mode. In SvelteKit 3, pass it to `sveltekit()` in `vite.config.ts`:

```ts
// vite.config.ts
sveltekit({
  compilerOptions: { experimental: { async: true } },
});
```

Then put a registry around your app, in the root layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

On the server, the provider creates a registry for each request, so visitors never see each other's state. Without one, the server throws `No AtomRegistry in context`. [Installation](https://atom.jarrednorris.dev/installation) covers the registry options and apps without SvelteKit.

## Example

```svelte
<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const greetingAtom = Atom.make(
    Effect.succeed("Hello from an Effect").pipe(Effect.delay("1 second"))
  );
</script>

<script lang="ts">
  import { useAtom, useAtomSuspense, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const greeting = useAtomSuspense(greetingAtom);
</script>

<button onclick={() => (count.current += 1)}>{count.current} × 2 = {doubled.current}</button>

<svelte:boundary>
  <p>{await greeting.current}</p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
  {#snippet failed()}<p>Something went wrong</p>{/snippet}
</svelte:boundary>
```

Hooks return an object whose `current` you read, assign or `bind:` to. Don't destructure `current`: `const { current } = useAtomValue(atom)` reads once and never updates. Coming from `@effect/atom-react`? See [Migrating from atom-react](https://atom.jarrednorris.dev/migrating-from-react).

## Learn more

- [Your first atom](https://atom.jarrednorris.dev/first-atom), [Reading and writing](https://atom.jarrednorris.dev/reading-and-writing) and [Async atoms](https://atom.jarrednorris.dev/async-atoms)
- [Server rendering](https://atom.jarrednorris.dev/server-rendering) and [Hydration](https://atom.jarrednorris.dev/hydration)
- [Effect RPC](https://atom.jarrednorris.dev/rpc) and [HttpApi](https://atom.jarrednorris.dev/http)
- [API reference](https://atom.jarrednorris.dev/reference) and [Troubleshooting](https://atom.jarrednorris.dev/troubleshooting)
- [Every export at a glance, and more recipes](https://github.com/jarrednorrisdev/effect-atom-svelte#api-at-a-glance), in the repository's README

## Versioning

The package is at 0.x, so a minor release can change the API. Every change is listed in the [changelog](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/packages/effect-atom-svelte/CHANGELOG.md).

## License

[MIT](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/LICENSE)
