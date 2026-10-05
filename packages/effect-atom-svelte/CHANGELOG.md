# effect-atom-svelte

## 0.1.0

### Minor Changes

- 6d56586: First release: Svelte 5 bindings for Effect Atom (`effect/reactivity`), following `@effect/atom-react`.

  - `@effect/atom-react`'s hooks: `useAtom`, `useAtomValue`, `useAtomSet`, `useAtomMount`, `useAtomRefresh`, `useAtomSubscribe`, `useAtomInitialValues` and the `AtomRef` hooks. Values come back as a reactive `current`, and each hook that reads an atom also takes a getter, `() => atom`, and follows it.
  - Async atoms with Svelte's experimental async support: `await useAtomResult(atom)` for a live `AsyncResult`, and `useAtomSuspense(atom)` for a promise awaited in markup, with `<svelte:boundary>` handling loading and failures.
  - Server rendering with one registry per request, and hydration of serializable atoms, so the browser starts from the server's results instead of running the effects again. `HydrationBoundary` hydrates state from Effect's `Hydration.dehydrate`.
  - `RegistryProvider` and `provideRegistry`, and `ScopedAtom` for atoms scoped to a component tree.
  - `effect-atom-svelte/sveltekit`: `handleError` hooks that keep an Effect error's `_tag` for a boundary's `failed` snippet.
