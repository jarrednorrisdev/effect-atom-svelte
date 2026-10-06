# effect-atom-svelte

## 0.1.1

### Patch Changes

- 08cfb3b: Fix a hook whose getter switches atoms in `onMount` computing the atom it left again. The hook released the old atom before Svelte had committed the switch, so the registry could sweep it while renders still read it, and they built it afresh, re-running its effect. The old atom is now kept until a later commit picks another.
- c4ffc6a: Require Svelte 5.57.2 or later. It fixes event handlers assigned after a top-level `await`, which were `undefined` in production builds, so `onclick={refresh}` did nothing when a hook after the `await` returned `refresh`.

## 0.1.0

### Minor Changes

- 6d56586: First release: Svelte 5 bindings for Effect Atom (`effect/reactivity`), following `@effect/atom-react`.

  - `@effect/atom-react`'s hooks: `useAtom`, `useAtomValue`, `useAtomSet`, `useAtomMount`, `useAtomRefresh`, `useAtomSubscribe`, `useAtomInitialValues` and the `AtomRef` hooks. Values come back as a reactive `current`, and each hook that reads an atom also takes a getter, `() => atom`, and follows it.
  - Async atoms with Svelte's experimental async support: `await useAtomResult(atom)` for a live `AsyncResult`, and `useAtomSuspense(atom)` for a promise awaited in markup, with `<svelte:boundary>` handling loading and failures.
  - Server rendering with one registry per request, and hydration of serializable atoms, so the browser starts from the server's results instead of running the effects again. `HydrationBoundary` hydrates state from Effect's `Hydration.dehydrate`.
  - `RegistryProvider` and `provideRegistry`, and `ScopedAtom` for atoms scoped to a component tree.
  - `effect-atom-svelte/sveltekit`: `handleError` hooks that keep an Effect error's `_tag` for a boundary's `failed` snippet.
