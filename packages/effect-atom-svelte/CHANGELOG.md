# effect-atom-svelte

## 0.3.0

### Minor Changes

- 4208ce3: Re-export Effect's `Reactivity` module beside `Atom`, `AtomRegistry` and the other `effect/reactivity` modules, so the reactivity keys mutations refresh can be used from `effect-atom-svelte` too.
- 4f0d922: `useAtomRef` and `useAtomRefPropValue` return a `current` you can assign for a writable `AtomRef`, which sets the ref or the property, so `bind:value={name.current}` works as it does with `useAtom`. A read-only ref, such as one from `map`, still returns a read-only `current`.

### Patch Changes

- 72bc355: Fix several edge cases in server rendering and hydration:

  - On the server, `useAtomResult` and `useAtomSuspense` render a value from `useAtomInitialValues` without running the atom, as `useAtomValue` already did, so a browser-only read or a request the value was there to save no longer runs on the server.
  - With `suspendOnWaiting`, the result sent to the browser is the settled one the server rendered, not one still waiting, which the browser would run again. This holds when another component reading the same atom without `suspendOnWaiting` rendered first.
  - On the server, `HydrationBoundary` ignores a value dehydrated as a promise that lands after the render, so it can no longer reach a later request through a registry the caller passes in. One that lands during the render is still what the server renders.
  - Destroying a `HydrationBoundary` keeps the values another boundary given the same state queued, as a layout and its page might be.
  - A seeded `useAtomSuspense` read in the script, outside any reaction, lets go of its atom once the getter moves on.
  - A hook after a top-level `await` no longer warns in development about a missed seed for an atom whose result the server didn't send, such as a defect.

- 73101b0: The devtools no longer carry a mapped atom's value across a hot reload: `Atom.make(1).pipe(Atom.map(...))` wrote its mapped value back into its source, so set to 5 it read 10, then 20 after the reload. Only pipes that leave an atom holding what is written to it (`keepAlive`, `autoDispose`, `setIdleTTL`, `setLazy`, `withEquality`, `withLabel`, `serializable`, `withServerValue`, `withServerValueInitial`) keep their value.

  Atoms declared in a SvelteKit route group, such as `src/routes/(app)/+page.svelte`, now show and open their real file, including those labelled with `Atom.withLabel`. The panel follows a `shortcut` prop the app changes after it has saved its settings, including settings saved by earlier versions, and keeps a shortcut chosen in the settings even when it is the default. A comment that mentions `<svelte:head>` before a component's script no longer stops its atoms being labelled. `atomLabels()` no longer warns that components aren't labelled when it comes after vite-plugin-svelte 7, which labels them.

  The inspector no longer reports a computation as `Refreshed` when an earlier refresh changed nothing and a parent changed since.

- 85be511: Error messages now end with a link to their entry on the troubleshooting page. "This atom value is read-only" also names the hooks that only read and the ones to write with instead, and "Two different atoms share the serialization key" says why the server can't render it and what to change.
- 7e2bc5c: A server render that fails while a serializable atom's result is still being prepared for the browser no longer reports an unhandled rejection ("registry is disposed"). The provider disposes of its registry when the failed render ends, and the pending result now stops there instead of reading from it.
- 63f9cfb: Fix atoms given a value by `useAtomInitialValues` being dropped while another component still held them: when one of two components seeding the same atom unmounted, the atom lost its value, and on the server a request sharing the registry could run the atom's browser-only read. On the server, requests rendering at the same time on a shared registry now keep the value the first one applied until the last of them ends.

  `provideRegistry` now disposes of the registry it created when its component is destroyed while its script is still awaiting. A reader whose getter switched to an atom that threw while subscribing now follows that atom once it recovers. `handleClientError` uses SvelteKit 2's message for an error whose own message is empty, such as a `Data.TaggedError`.

- 22a7551: Fix three cases where server-rendered state reached the browser wrongly:

  - Remounting a component that makes its own serializable atom, such as a `ScopedAtom` provider under `{#key}` with its input in the serialization key, no longer throws `Two different atoms share the serialization key`. Svelte sets up the new copy before it destroys the old one, so for a moment both hold the key. In the browser, the server's value now belongs to the key, not to the atom that first claimed it, so the new copy shares it, as both already share the registry's value. The server render still throws.
  - The browser's first render inside a `HydrationBoundary` now matches the server's markup when the atom already exists, as with a value from `RegistryProvider`'s `initialValues` or an atom also read above the boundary. While the page hydrates, the boundary updates those atoms before its children render, as the server does. This needs Svelte's `experimental.async`; without it they are updated after the first render, as before. Each server-rendered page with a `HydrationBoundary` carries one more small `hydratable` entry for this.
  - In the browser, a value dehydrated as a promise that lands after its `HydrationBoundary` is destroyed, including one destroyed while its children were still loading, is ignored, so it no longer reaches whoever reads the atom later. A reader that already held the atom when the boundary was destroyed, such as a layout's reader above it, still gets the value.

- c64799e: Fix `useAtomSuspense` with `includeFailure` resolving, after it waited, with a copy of the atom's result rather than the result itself. The copy lost a `Failure`'s `previousSuccess`, so `AsyncResult.getOrElse` and `AsyncResult.value` no longer fell back to the last value. It showed in a promise awaited in the script or an event handler.
- 5d0a215: Make the inspector report more accurately, which the devtools show:

  - An inspector scope's snapshot and `ScopeChanged` follow an atom in the scope that switches what it reads, also when it mounts, subscribes to or writes another atom while computing, and also while nothing listens to the scope.
  - `Interrupted` (a cross in the devtools) is reported only for the effect atom whose fiber was interrupted, not also for a wrapper passing its result on, such as `Atom.debounce`, `makeRefreshOnSignal` or `refreshOnWindowFocus`, and not for an `Atom.runtime` released while its layer builds, which carries on.
  - `idleTTL` gives `undefined` for an atom with an idle TTL of 0, which is removed as soon as nothing reads it.

- f6f0c9c: Fix several things `effect-atom-svelte/inspector` reported wrongly. A lazy atom no longer names a parent as the cause of its next computation when that parent changed while the atom was computing, before the atom read it. A node with an initial value (`initialValues`) that hasn't computed yet reports its first computation as a first read. A node removed after its idle TTL reports its interruption and finalizers before its removal, as other removals do. `registry.reset` reports the readers it drops. In a scope, a component reading a serializable atom whose node another atom object with the same key made (as after a hot reload) points at that node. The docs now say a refresh signal (`refreshOnWindowFocus`, `makeRefreshOnSignal`, `swr`) is reported as `Refreshed`, as it always was.

  Fix the devtools labelling a component with a `generics` attribute holding `>` wrongly, and taking a `<script>` inside `<svelte:head>` for the component's script: an inline head script got an `import` that broke the page, and a JSON-LD script stopped the component's atoms being labelled. A shortcut recorded with a key whose code has several words (`ArrowUp`, `PageDown`, `BracketLeft`) now opens the panel once saved, and is shown as such rather than as `Arrowup`. The graph puts both sides of a diamond to the right of its source whichever atom a scope lists first.

- 456cf7c: Fix pending `useAtomSet` calls and initial values in edge cases:

  - A `"promise"` or `"promiseExit"` call no longer hangs when the `RegistryProvider` that created its registry is destroyed mid-call: the call is interrupted and the promise settles as interrupted. A registry you pass in yourself is still yours to dispose of.
  - A `"promise"` or `"promiseExit"` call pending when another setter writes `Atom.Reset` settles as interrupted, instead of hanging, or resolving with the `initialValue` of an `Atom.fn` that has one. `Atom.Interrupt` remains the way to cancel a call.
  - `useAtomInitialValues` lets go of the entries it applied when a later entry throws, so on the server a registry shared between requests no longer renders the failed request's value in the next one.
  - A finalizer that throws while a `RegistryProvider` (or `provideRegistry` without a `registry`) disposes of its registry in the browser is reported as an uncaught error after teardown, instead of being thrown into Svelte's teardown, where it left every `$derived` on the page running again on every read until reload.

- 5c740ad: A reader whose atom is built for the first time by its own read, after the component has mounted, no longer updates a second time with the value it just read. `useAtomValue(() => family(id), transform)` ran the transform twice when `id` switched to an atom not built yet, returning a new object for an unchanged value; an `$effect` that first read an atom ran twice; and code after awaiting `useAtomSuspense` of an atom that resolves at once, in an `$effect`, ran twice.
- 67d468b: Fix the first refresh of an atom with a value from `initialValues` or `useAtomInitialValues` being lost after the server's result or a `HydrationBoundary` value replaced that value: the atom ran again, but kept showing the old value, and `revalidateOnHydrate` did nothing for it. This includes an atom wrapped by `Atom.withRefresh` or similar, whose initial value goes to the atom it wraps. Effect's registry kept the initial value through the next computation even though the atom had a value of its own by then.
- 876bdd1: Fix two more ways a server render could keep atoms after a `<svelte:boundary>` with a `failed` snippet caught an error thrown while its children set up:

  - A dropped component whose script awaits before calling its hooks now lets go of its atoms on a registry the caller keeps across requests. Its script resumed after the render had ended, so its atoms stayed held and the next request rendered this one's initial value.
  - A `RegistryProvider` without a `registry` prop inside such a boundary now disposes its registry on the server, so its `keepAlive` atoms, and whatever they run, no longer outlive the request.

  A `useAtomValue` reader kept past the render no longer keeps the atom its getter switches to mounted on a registry the caller keeps.

- dfd7db3: Fix two cases where the server ran an atom that had a value from `useAtomInitialValues`, which renders that value instead so that a browser-only read or a request the value was there to save doesn't run:

  - An atom wrapped by `Atom.withRefresh`, `Atom.withReactivity`, `Atom.swr`, `Atom.debounce` or `Atom.makeRefreshOnSignal`, or an `AtomRpc` or `AtomHttpApi` query with `reactivityKeys`. The value goes to the wrapped atom, and every hook now renders it from there.
  - A serializable atom read with `useAtomSuspense` and awaited in the markup straight away.

- 473c6e1: Fix server renders leaving atoms held on a registry the caller keeps across requests when a `<svelte:boundary>` with a `failed` snippet caught an error thrown while its children set up. Svelte drops those children's `onDestroy` callbacks, so their mounts, holds and `useAtomInitialValues` values stayed, and the next request rendered the earlier request's initial value. The hooks and `HydrationBoundary` now also let go when the render ends.
- e0d92a1: `useAtomSubscribe` with a getter now subscribes again only when the getter returns a different atom. A getter that ran again and returned the same atom, as `() => profileAtom(user.id)` does for a new `user` with the same id, called `f` again with an unchanged value under `immediate`, and could drop a change still waiting to be delivered.

  A seed the browser can't decode with the atom's schema, as after a deploy between the server render and hydration, is now dropped and the browser computes the atom, as for a result the server couldn't encode. It made `useAtomSuspense` and `useAtomResult` reject for good, with unhandled rejections. Development builds warn.

- c64799e: Fix two ways `useAtomSuspense` kept an atom loading after its component was destroyed, on a registry that outlives the component:

  - Its promise read through a `$derived` that only the script or an event handler reads, as in `const todos = $derived(list.current)` awaited in a click handler. Svelte never aborts such a derived's signal, so the wait it held was never let go of. Each read now also lets go when the component is destroyed.
  - Its promise read after the component was destroyed, as in `onDestroy` or a handler that resumes later. A result the component had already settled is still returned; one it would have to wait for now rejects with the abort reason, without starting the atom.

- c01da28: `handleClientError` and `handleServerError` now type-check as SvelteKit 2's `HandleClientError` and `HandleServerError`, whose `App.Error` requires a message: given SvelteKit 2's input, which has no `kind`, they are typed to return one, as they always set one there. `handleClientError` also uses SvelteKit 2's message for an error whose own message is empty, such as a `Data.TaggedError`.

  The docs now say that SvelteKit 2 runs errors in a boundary through `handleError` only with `kit.experimental.handleRenderingErrors`, and use SvelteKit 3's `#lib` in their imports.

- 85be511: In development, the server now warns once per serialization key when `useAtomValue` or `useAtom` reads a serializable async atom that is still running. Only `useAtomResult` and `useAtomSuspense` send an atom's result to the browser, so that atom runs again there, which the page showed only as a second request. A key the page sends anyway, through one of those hooks in the same render or a `HydrationBoundary`, doesn't warn, nor does a result nothing is computing, such as a mutation nobody has called.

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
