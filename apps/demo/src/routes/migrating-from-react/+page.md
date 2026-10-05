---
title: Migrating from atom-react
description: How the hooks, providers and server rendering of @effect/atom-react map to effect-atom-svelte.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

effect-atom-svelte follows `@effect/atom-react`: the same atoms, the same registry, and hooks with the same names. Your atoms, families, runtimes, `AtomRpc` and `AtomHttpApi` clients carry over unchanged, because they come from `effect/reactivity`, not from either adapter. What changes is how a component reads them, because a Svelte component's script runs once rather than on every render.

## The hooks

| `@effect/atom-react` | effect-atom-svelte |
| --- | --- |
| `const value = useAtomValue(atom)` | `const value = useAtomValue(atom)`, read as `value.current` |
| `useAtomValue(atom, f)` | The same, read through `current` |
| `const [value, setValue] = useAtom(atom)` | `const value = useAtom(atom)`, read and assign `value.current` |
| `useAtomSet(atom, { mode })` | The same, but the promise modes reject `Atom.Reset`: reset with a `"value"` setter. Promise setters also take `{ signal }` |
| `useAtomSuspense(atom)`, which suspends | `useAtomSuspense(atom)`, whose `current` you `await` in markup |
| None | `await useAtomResult(atom)` in the script |
| `useAtomMount`, `useAtomRefresh` | The same |
| `useAtomSubscribe` | The same, but it computes the atom, so a derived atom nothing else reads still runs |
| `useAtomInitialValues` | Also holds its atoms while the component lives, and gives a wrapped atom's value to its source, as `initialValues` does. See [Starting values from a component](/reading-and-writing#starting-values-from-a-component) |
| `useAtomRef(ref)`, `useAtomRefPropValue(ref, prop)` | The same, read through `current` |
| `useAtomRefProp(ref, prop)` | The same |

### `current` instead of a value

A React hook returns the value for this render, and React renders again when it changes. A Svelte hook returns an object whose `current` reads the atom. Read it in markup, `$derived` or `$effect`, and Svelte updates whatever read it.

**Example** (A counter in each)

```tsx
// React
const [count, setCount] = useAtom(countAtom);
return <button onClick={() => setCount((n) => n + 1)}>{count}</button>;
```

```svelte
<!-- Svelte -->
<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  const count = useAtom(countAtom);
</script>

<button onclick={() => (count.current += 1)}>{count.current}</button>
```

Don't destructure `current` in the script: `const { current } = useAtomValue(atom)` reads once and never updates.

`useAtom` has no `mode` option, and assigning `current` takes a value, not an updater function. For a promise of a mutation's result, or an updater, use `useAtomSet`.

### Getters instead of new arguments

A React component calls its hooks again on every render, so `useAtomValue(todoAtom(id))` follows `id` on its own. A Svelte script runs once. Pass a getter, and the hook follows whichever atom it returns:

```ts
const todo = useAtomValue(() => todoAtom(id));
```

Every hook that takes an atom or a ref also takes a getter, except `useAtomRefProp`, which takes the ref itself. See [Following a different atom](/reading-and-writing#following-a-different-atom).

### Where hooks can be called

React hooks run on every render, in the same order. Svelte hooks run once, while the component initializes, because they find the registry through Svelte's context:

- **At the top level of the script.** This includes after a top-level `await`, where Svelte restores the context.
- **Not in callbacks.** An event handler, a `setTimeout` or a function of your own after an `await` runs too late, and Svelte throws `lifecycle_outside_component`. Call the hook at the top level and keep what it returns.
- **Before an `await` when the markup uses the result as a handler.** See [Handlers after an await](/troubleshooting#handlers-after-an-await).

[Troubleshooting](/troubleshooting#can-only-be-used-during-component-initialisation) covers the errors.

## Suspense

React's `useAtomSuspense` throws a promise until the atom has a value, and a `<Suspense>` boundary shows its fallback meanwhile. It returns the `Success` result, so you read `.value`, and a failure throws to the nearest error boundary.

Here, `useAtomSuspense` returns a promise that you `await` in markup, inside a `<svelte:boundary>`:

```svelte
<script lang="ts">
  const todo = useAtomSuspense(todoAtom);
</script>

<svelte:boundary>
  <p>{(await todo.current).title}</p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
  {#snippet failed()}<p>Could not load the todo.</p>{/snippet}
</svelte:boundary>
```

- The promise resolves to the **value**, not the `Success` result.
- With `includeFailure: true`, it resolves to the `Success` or `Failure` result, as React's hook returns with that option.
- `suspendOnWaiting` works the same in both.

`useAtomResult` has no React counterpart. Awaited at the top level of the script, it waits for the first result, and returns a live `AsyncResult`. See [Suspense](/suspense).

## The registry

| `@effect/atom-react` | effect-atom-svelte |
| --- | --- |
| `<RegistryProvider>` | `<RegistryProvider>`, or `provideRegistry()` in a script |
| `useContext(RegistryContext)` | `getRegistry()` |
| No provider: a module-level default registry | No provider: a shared default registry in the browser, and an error on the server |
| Registry work runs on React's scheduler, at low priority. The default registry also has `defaultIdleTTL: 400` | Effect's default scheduler, and no idle TTL unless you pass `defaultIdleTTL` |

`RegistryProvider` takes the same `initialValues`, `scheduleTask`, `timeoutResolution` and `defaultIdleTTL`. It also takes `registry`, to provide one you made yourself, and `revalidateOnHydrate`. See [Registry options](/installation#registry-options).

So an atom nothing reads lasts 400 milliseconds in React's default registry, but is dropped here once the current task ends. React's `RegistryProvider` has no idle TTL either, unless you pass one.

React's default registry, used when there is no provider, is one module-level registry, on the server too. Here, the server throws `No AtomRegistry in context` instead, so a page can't share one visitor's state with another. Put a `RegistryProvider` in your root layout.

## Server rendering and hydration

With React, you dehydrate a registry on the server and pass the state to a `HydrationBoundary`. Here, `useAtomResult` and `useAtomSuspense` do that for you: the server waits for the atoms they read, sends the results of serializable ones with the page, and the browser starts from them. See [Hydration](/hydration).

`HydrationBoundary` exists here too, with the same `state` prop, for data that comes from a `load` function or a remote function. See [HydrationBoundary](/hydration#hydrationboundary).

<Aside type="caution" title="Nothing runs again after hydration by default">

In `@effect/atom-react`, some queries are fetched again straight after hydration, as a side effect of how Effect's `Hydration.hydrate` restores atoms wrapped by `Atom.withReactivity`, `swr`, `debounce` and similar. That includes `AtomRpc` and `AtomHttpApi` queries with `reactivityKeys`. Here, the hooks run nothing again unless you set `revalidateOnHydrate`, on `RegistryProvider` or on the hook. `HydrationBoundary` goes through `Hydration.hydrate`, so it behaves like React's. See [Running again after hydration](/hydration#running-again-after-hydration).

</Aside>

## Scoped atoms

Both adapters have `ScopedAtom.make`, with the same factory. React gives you a `Provider` component and a `use` hook. Here, the providing component calls `provide` in its script, and `use` works as before:

```tsx
// React
<Counter.Provider value={10}>
  <CounterButton />
</Counter.Provider>
```

```svelte
<!-- Svelte, in the component that owns the counter -->
<script lang="ts">
  Counter.provide(10);
</script>

<CounterButton />
```

There is no `Context` property. See [Scoped atoms](/scoped-atoms).
