# effect-atom-svelte

Svelte 5 bindings for [Effect Atom](https://effect.website) (`effect/reactivity`), in the shape of the official `@effect/atom-react` and `@effect/atom-vue` adapters.

**Status:** pre-release, not yet published. Targets `effect` 4.0, Svelte 5.57+ and SvelteKit 3. Server rendering and the async hooks need Svelte's `experimental.async` compiler option.

## Setup

Put a registry at the root. On the server it gives every request its own registry and disposes it when rendering ends; in the browser it lives for the session.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

`RegistryProvider` takes the `AtomRegistry.make` options (`initialValues`, `scheduleTask`, `defaultIdleTTL`) or an existing `registry`, plus `revalidateOnHydrate` (see [Server rendering and hydration](#server-rendering-and-hydration)). `provideRegistry()` does the same from a component script.

Without a provider the browser falls back to a shared registry; the server throws instead, because a module-level registry would share atom state between concurrent requests.

## Reading and writing

Hooks return objects with a reactive `.current`, Svelte's convention for reactive values. Every hook accepts an atom, or a getter so it follows a different atom when reactive state changes.

```svelte
<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom); // read and assign .current; works with bind:
  const parity = useAtomValue(countAtom, (n) => (n % 2 ? "odd" : "even"));
  const todo = useAtomValue(() => todoAtom(selected.current)); // follows the selected atom
  const save = useAtomSet(saveAtom, { mode: "promise" }); // or "promiseExit", or the default "value"
</script>

<input bind:value={count.current} type="number" />
```

| Hook | Does |
| --- | --- |
| `useAtomValue(atom, f?)` | Reads, optionally transformed. Mounted while something reactive reads it. |
| `useAtom(atom)` | Reads and writes through `.current`. |
| `useAtomSet(atom, { mode })` | Setter. `promise` and `promiseExit` modes take an `AbortSignal`. |
| `useAtomMount(atom)` | Keeps an atom mounted for the component's lifetime without reading it. |
| `useAtomRefresh(atom)` | Returns a function that recomputes the atom. |
| `useAtomSubscribe(atom, f, { immediate })` | Calls `f` on each change. |
| `useAtomInitialValues(pairs)` | Sets starting values once per registry. |
| `useAtomRef`, `useAtomRefPropValue` | Read an `AtomRef` or one of its properties. `useAtomRefProp` returns the prop ref. |
| `useAtomResult(atom)` | `await` an async atom's first result, then a live `AsyncResult`. SSR and hydration. With a getter, a later atom is followed without awaiting again. |
| `useAtomSuspense(atom, options)` | An async atom as a promise for `await` in markup. |
| `ScopedAtom.make(f)` | An atom per subtree: `provide(input)` in a parent, `use()` below it. |
| `<HydrationBoundary state>` | Hydrates state from `Hydration.dehydrate`, for example returned by a remote function. |

The package also re-exports `AsyncResult`, `Atom`, `AtomHttpApi`, `AtomRef`, `AtomRegistry`, `AtomRpc` and `Hydration` from `effect/reactivity`.

## Async components

With `experimental.async`, a component can `await` atoms directly.

```svelte
<script lang="ts">
  const todos = await useAtomResult(todosAtom); // SSR waits; hydration reuses the server's result
</script>

<svelte:boundary>
  {#each await user.current.todos as todo}…{/each}
  {#snippet pending()}Loading…{/snippet}
</svelte:boundary>
```

- Hooks can be called before or after top-level `await`s in a component script: Svelte restores the component context after each one. Like any Svelte lifecycle function, a hook cannot be called after an `await` inside your own async helper, because only top-level awaits get the context back. Awaiting several atoms in sequence makes requests that could run in parallel wait for each other; start them together with `await Promise.all([useAtomResult(a), useAtomResult(b)])` when they are independent.
- Every hook takes an atom or a getter (`() => atom`) that follows reactive state. `await useAtomResult(() => userAtom(id))` waits only for the first atom; when `id` changes, the handle switches to the new atom's result, which is usually `Initial` until it loads. Use `useAtomSuspense` when a switch should show the boundary's pending state again.
- `useAtomSuspense(...).current` is a promise that stays the same object while the result is unchanged, so dependents only re-run on real updates. Failures reject with the squashed cause; `includeFailure: true` resolves with the `Failure` instead, and `suspendOnWaiting: true` treats a refresh as pending again.

## Server rendering and hydration

- An atom read on the server stays mounted for the request, so the registry does not sweep it while rendering is suspended, and is released when rendering ends. That includes a registry you pass to `RegistryProvider`: it is not disposed, but each request's atoms are released from it and every request embeds its own hydration seeds. Atoms with an `Atom.withServerValue` override are never computed on the server.
- Give async atoms a serialization key (`AtomRpc.query(..., { serializationKey })`, `AtomHttpApi.query(..., { serializationKey })` or `Atom.serializable`). `useAtomResult` and `useAtomSuspense` then pass the encoded result to the client through Svelte's `hydratable`, so hydration does not wait on the network. Only a server value seeds the registry, and only while a component using it is still mounted; after client-side navigation the atom is fetched in the browser as usual. Two different atoms with the same key throw.
- **Hydrated atoms are not fetched again.** The server's value is milliseconds old, so `useAtomResult` and `useAtomSuspense` keep it until something refreshes the atom, such as a mutation on its reactivity keys. **This differs from `@effect/atom-react`**, where a query wrapped by `Atom.withReactivity` (as `AtomRpc.query` and `AtomHttpApi.query` do for `reactivityKeys`) or by `swr`, `debounce`, `withRefresh` or `makeRefreshOnSignal` is fetched again straight after hydration, as a side effect of how `AtomRegistry` seeds wrapped atoms. To fetch again once hydration is done, set `revalidateOnHydrate` on `RegistryProvider`, or on a hook (`useAtomSuspense(atom, { revalidateOnHydrate: true })`), which overrides the provider. When components share a serialization key, the atom is fetched again if any of them asks. `HydrationBoundary` hydrates through `Hydration.hydrate` and keeps `AtomRegistry`'s behaviour.
- A `<svelte:boundary>` with a `pending` snippet renders that snippet on the server and leaves its content to the client. Leave `pending` out where the first paint needs the data.
- Browser-only atoms need a server value. `Atom.refreshOnWindowFocus` and `Atom.kvs` with `localStorage` touch `window` when computed: wrap them in `Atom.withServerValue`.

## SvelteKit notes

- SvelteKit runs errors through `handleError` before a boundary's `failed` snippet sees them; by default the snippet only gets `{ status: 500, message: "Internal Error" }`. To show a typed error, use `includeFailure: true` and read the `Failure`, or add a client `handleError` hook that keeps the message and `_tag` (see `apps/demo/src/hooks.client.ts`).
- Data can come from `await` in components alone; no `load` or server files are needed.

## Behaviour worth knowing

- Promise-mode setters resolve with the atom's next settled result. When a second `Atom.fn` call supersedes one in flight, both promises resolve with the second call's result, as in `@effect/atom-react`.
- A mutation still running when its component unmounts completes: the promise holds its own subscription, so navigating away does not cancel a write.
- A read that is abandoned stops waiting. When a `useAtomSuspense` getter moves to another atom while the old one is still loading, or the component unmounts, the old wait lets go of its atom, so the registry disposes it and interrupts its request. The abandoned promise rejects with Svelte's own abort reason, which Svelte ignores, so a render still waiting on it keeps waiting for the next value rather than showing the interruption. The same goes for `await useAtomResult(...)` in a component removed before the result arrives. A `useAtomSuspense` promise read outside a template or effect (a top-level `await` in the script, an event handler) is held until the component is destroyed.
- In a monorepo, make sure the bundler loads one copy of `effect`. Workspace packages compiled from source can otherwise get their own, and their schemas and service tags stop matching (`resolve: { dedupe: ["effect"] }` in Vite).

## How it works

Each read goes through `createSubscriber` from `svelte/reactivity`, subscribed to the registry while something reactive reads `.current`. The registry notifies subscribers synchronously while it computes an atom, and Svelte throws `state_unsafe_mutation` if state changes while a template or `$derived` is evaluating. Reads are counted, and a notification raised during one is delivered on a microtask; outside a read, notifications stay synchronous so event-handler writes update in the same tick.

## Development

```sh
bun run --cwd packages/effect-atom-svelte test   # Vitest: browser mode (Chromium) and Node SSR
bun run --cwd packages/effect-atom-svelte check  # svelte-check
bun run --cwd apps/demo test                     # Playwright against a production build of the demo
```

The tests run real `AtomRpc` and `AtomHttpApi` clients against `@demo/domain`'s server in-process.
