# effect-atom-svelte

## 0.2.0

### Minor Changes

- 7dabe68: Add `effect-atom-svelte/inspector`, for developer tools. `inspect(registry)` reports what a registry does to its atoms: each node added and removed, each computation and why it ran (first read, a parent changed, a refresh), each new value and where it came from, readers coming and going, interruptions and finalizers. `registries()` and `watchRegistries` list the registries an app's providers hold, in the browser during development. `provideInspectorScope()` makes a part of the component tree a scope: the hooks below it report the atoms they use, and the scope shows those atoms, everything upstream of them and the hooks, with events for just those atoms; it works in production too, for pages that draw their own atoms. `nameComponent(name, file)` names a component for the scopes its hooks report to. A registry nobody inspects runs as before, and production builds don't list registries. The API is unstable.

## 0.1.2

### Patch Changes

- 54de52a: Fix `useAtomSet`'s `promise` and `promiseExit` modes settling a call whose signal was already aborted with the result of an earlier call. When the `Atom.fn` already held a settled result, the call resolved with that result instead of settling as interrupted. It now settles as interrupted whatever the atom holds, as the docs say.

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
