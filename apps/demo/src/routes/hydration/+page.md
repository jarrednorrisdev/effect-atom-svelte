---
title: Hydration
description: Send the server's results to the browser, so it doesn't run the same effects again.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Where from "./where.svelte";
  import whereSource from "./where.svelte?highlight";
</script>

When a page rendered on the server starts up in the browser, its atoms start empty. Without help, every async atom would run its effect again, repeating the server's work, and the page would flash a loading state over content it already shows. **Hydration** sends each result the server computed along with the page, and the browser starts from it.

The atom below records where it was computed. This page was rendered on the server when the site was built, so the browser shows the server's result without computing it. Click **Compute again** to compute it in the browser.

<Example files={[{ html: whereSource, name: "where.svelte" }]}> <Where /> </Example>

## Serializable atoms

To travel to the browser, a result has to be encoded. `Atom.serializable` gives an atom a key that is unique to it, and a schema that encodes its value:

**Example** (A serializable async atom)

```ts
import { Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

const todosAtom = Atom.make(fetchTodos).pipe(
  Atom.serializable({
    key: "todos",
    schema: AsyncResult.Schema({
      success: Schema.Array(Todo),
      error: TodosError,
    }),
  })
);
```

For `AtomRpc` and `AtomHttpApi` queries, pass a `serializationKey` instead. The client builds the schema from the procedure or endpoint:

```ts
const todosAtom = TodosRpc.query("listTodos", undefined, {
  serializationKey: "todos",
});
```

<Aside type="caution" title="One key, one atom">

Two different atoms with the same key on one page make the server render throw. In a family, put the family's key into the serialization key, such as `` `todo-${id}` ``.

</Aside>

## How the result travels

`useAtomResult` and `useAtomSuspense` do the work. On the server, each one waits for the atom's result and hands it to Svelte's `hydratable`, which writes it into the page. In the browser, the same hook finds the result there and puts it in the registry before the atom computes, so the atom's effect never runs.

A few things follow from that:

- **Only those two hooks carry results.** An atom read only with `useAtomValue` is computed again in the browser.
- **Only the first page load is hydrated.** After the browser navigates to another page, atoms run their effects as usual.
- **A result arrives only if something still uses it.** If every component that reads the atom is gone before the result lands, it is dropped.

## Running again after hydration

A hydrated atom keeps the server's result until something refreshes it, such as a mutation on its reactivity keys. The result is milliseconds old, so running the effect again would be wasted work.

To run it again once the page has hydrated, set `revalidateOnHydrate`. On `RegistryProvider` it applies to every atom, and on a hook it applies to that atom and overrides the provider:

```svelte
<RegistryProvider revalidateOnHydrate>{@render children()}</RegistryProvider>
```

```ts
const prices = useAtomSuspense(pricesAtom, { revalidateOnHydrate: true });
```

When several components read the same serializable atom, it runs again if any of them asks.

<Aside type="note" title="Different from @effect/atom-react">

In `@effect/atom-react`, some queries are fetched again straight after hydration, as a side effect of how Effect's `Hydration.hydrate` restores atoms wrapped by `Atom.withReactivity`, `swr`, `debounce` and similar. That includes `AtomRpc` and `AtomHttpApi` queries with `reactivityKeys`. Here, no atom runs again unless you set `revalidateOnHydrate`.

</Aside>

## A getter must pick the same atom

The browser can only use the server's result for the atom the server rendered. When a hook takes a getter, its first choice in the browser must match the server's. If the browser picks a different serializable atom, there is no result for it. Svelte throws `hydratable_missing_but_required` in development. A production build warns, runs the atom in the browser, and the markup can mismatch.

This happens when the choice depends on state only the browser has, such as a filter saved in `localStorage`. Either base the first choice on state the server also has (the URL, a cookie, page data), or keep the server's choice until the component has mounted:

**Example** (Switching to a saved filter after mounting)

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { useAtomSuspense, useAtomValue } from "effect-atom-svelte";

  // Atom.kvs over localStorage, with withServerValue(() => "all") for the server.
  const saved = useAtomValue(savedFilterAtom);

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const todos = useAtomSuspense(() => todosFor(mounted ? saved.current : "all"));
</script>
```

The first render uses `"all"` on both sides, and hydrates from the server's result. The switch to the saved filter then runs in the browser, like any later switch.

## HydrationBoundary

Sometimes the data for a page comes from somewhere other than a component's render, such as a `load` function or a remote function. `Hydration.dehydrate` collects the serializable atoms of a registry, and `<HydrationBoundary>` puts them into the browser's registry:

**Example** (Hydrating from a load function)

```ts
// src/routes/todos/+page.server.ts
import { Effect } from "effect";
import { AtomRegistry, Hydration } from "effect/reactivity";

export const load = async () => {
  const registry = AtomRegistry.make();
  const release = registry.mount(todosAtom);
  await Effect.runPromise(AtomRegistry.getResult(registry, todosAtom));
  const state = Hydration.dehydrate(registry);
  release();
  registry.dispose();
  return { state };
};
```

```svelte
<!-- src/routes/todos/+page.svelte -->
<script lang="ts">
  import { HydrationBoundary } from "effect-atom-svelte";

  const { data } = $props();
</script>

<HydrationBoundary state={data.state}>
  <TodoList />
</HydrationBoundary>
```

Atoms the browser's registry doesn't have yet are hydrated before the children render. Atoms it already has are updated after the render, so the page on screen doesn't change halfway through a render. `HydrationBoundary` uses Effect's `Hydration.hydrate`, so unlike the hooks it keeps the registry's behavior of running wrapped atoms again.
