---
title: Hydration
description: Send the server's results to the browser, so it doesn't run the same effects again.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import HydrationBoundaryExample from "./hydration-boundary.svelte";
  import hydrationBoundarySource from "./hydration-boundary.svelte?highlight";
  import pricesRemoteSource from "./prices.remote.ts?highlight";
  import pricesSource from "./prices.svelte?highlight";
  import pricesAtomsSource from "./prices.ts?highlight";
  import Revalidate from "./revalidate.svelte";
  import revalidateSource from "./revalidate.svelte?highlight";
  import SavedFilter from "./saved-filter.svelte";
  import savedFilterSource from "./saved-filter.svelte?highlight";
  import Travel from "./travel.svelte";
  import travelSource from "./travel.svelte?highlight";
  import Where from "./where.svelte";
  import whereSource from "./where.svelte?highlight";
</script>

When a page rendered on the server starts up in the browser, its atoms start empty. Without help, every async atom would run its effect again, repeating the server's work, and the page would flash a loading state over content it already shows. **Hydration** sends each result the server computed along with the page, and the browser starts from it.

From server to browser, a page load goes like this:

1. A request comes in, and the server creates a registry for it.
2. The server renders the page with that registry, and encodes the results of the serializable atoms read with `useAtomResult` or `useAtomSuspense`.
3. It sends the HTML with those results, then disposes of its registry. The registry itself never leaves the server.
4. The browser creates its own registry, puts the server's results into it, and hydrates the page. Atoms without a result from the server compute again.
5. From then on, atoms run in the browser's registry, including on other pages the visitor opens. Server `load` functions and remote functions still run on the server when SvelteKit calls them.

On a prerendered page, steps 1 to 3 happen once, when the site is built.

The atom below records where it was computed. This page was rendered on the server when the site was built, so the browser shows the server's result without computing it. Click **Compute again** to compute it in the browser.

<Example files={[{ html: whereSource, name: "where.svelte" }]} hint="Opened straight from the server, the history starts at Success, with no loading state. Click Compute again and watch the browser run the effect itself."> <Where /> </Example>

## Serializable atoms

To travel to the browser, a result has to be encoded. `Atom.serializable` gives an atom a key that is unique to it, and a schema that encodes its value:

**Example** (A serializable async atom)

```ts
import { Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

const todosAtom = Atom.make(fetchTodos).pipe(
  Atom.serializable({
    key: "app/todos",
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

The keys go to Svelte's `hydratable`, which everything on the page shares, other libraries included. Give yours a prefix of your own, such as `app/`. `AtomRpc` and `AtomHttpApi` prefix theirs with a fixed word and the procedure or endpoint: `AtomRpc:${tag}:${serializationKey}` and `AtomHttpApi:${group}:${endpoint}:${serializationKey}`. So `serializationKey: "todos"` on `listTodos` becomes `AtomRpc:listTodos:todos`.

The prefix doesn't name the client. Two RPC clients with a procedure of the same name, or two HTTP API clients with the same group and endpoint, give the same key for the same `serializationKey`. Make the `serializationKey`s differ, for example by starting each with the client's name.

</Aside>

## Which atoms to serialize

Make an atom serializable when its value is plain data and the server's result is the one the browser wants: a todo list, a user's profile, the prices on a product page. A schema can encode it, and the browser is spared a second request and a loading state.

Leave it out when the value can't travel or shouldn't:

- **Live resources**, such as a WebSocket, a database connection pool or a stream subscription. There is no way to send them; the browser has to open its own.
- **Values with behavior**, such as functions or class instances with private state. A schema rebuilds data, not closures.
- **Values that depend on where they run**, such as the window's width, something read from `localStorage`, or the current time. The server's answer would be wrong in the browser, so let it compute again, or keep the atom off the server with [server values](/server-rendering#server-values).

Leaving out an atom whose value could travel costs time. A component that awaits it waits for the browser to compute it again before it hydrates, so until the effect finishes, the component shows the server's markup but doesn't respond to clicks.

<Aside type="danger" title="A serialized result is in the page">

The encoded results are plain text in the page's HTML, where anyone who gets the page can read them, whether or not a component shows them. That includes typed errors, with all their fields. Never serialize data the visitor mustn't see. For a page whose serialized results belong to one visitor, see [Prerender or render per request](/sveltekit#prerender-or-render-per-request).

</Aside>

## How the result travels

`useAtomResult` and `useAtomSuspense` do the work. On the server, each one waits for the atom's result and hands it to Svelte's `hydratable`, which writes it into the page. In the browser, the same hook finds the result there and puts it in the registry before the atom computes, so the atom's effect never runs.

A few things follow from that:

- **During a render, only those two hooks carry results.** An atom read only with `useAtomValue` is computed again in the browser.
- **Only the first page load is hydrated.** After the browser navigates to another page, atoms run their effects as usual.
- **A result arrives only if something still uses it.** If every component that reads the atom is gone before the result lands, it is dropped.
- **The hooks don't send a defect.** For a failure with a defect or an interruption, the hooks send no result, as the defect's message and cause could reveal details of the server. The browser computes the atom itself. Typed errors are part of the atom's schema, so they are sent. Effect's `Hydration.dehydrate` doesn't skip defects: see [HydrationBoundary](#hydrationboundary).
- **A result the schema can't encode isn't sent.** The server renders it, and the browser computes the atom itself, as Effect's `Hydration.dehydrate` skips it too. In development the server warns, with the schema's error.
- **A stream sends its latest item, as waiting.** The server's render ends while the stream still runs, so the browser starts from that item and runs the stream again. See [Streams on the server](#streams-on-the-server).

The example reads three atoms that record where they ran. All three were in the server's HTML, but only the serializable one read by `useAtomResult` kept the server's result: the atom without a key ran again in the browser, and so did the one read with `useAtomValue`, which the server rendered as `Initial`.

<Example files={[{ html: travelSource, name: "travel.svelte" }]} hint="Compare In the HTML with the result now: only the first row still has the server's result. Open another page from the sidebar and come back: all three run in the browser, as only the first page load is hydrated."> <Travel /> </Example>

## Streams on the server

A [stream atom](/streams) read with `useAtomResult` or `useAtomSuspense` is in the page with the latest item it had when the render ended, marked as waiting. The server's stream stops with its registry, so the browser runs the stream again. Until the browser's first item arrives, the page keeps showing the server's, so it doesn't flash a loading state. To keep a stream off the server, see [Keep browser-only streams off the server](/streams).

## Running again after hydration

A hydrated atom keeps the server's result until something refreshes it, such as a mutation on its reactivity keys. On a page rendered for the request, the result is milliseconds old, so running the effect again would be wasted work. On a prerendered page, it is as old as the build.

To run it again in the browser, set `revalidateOnHydrate`. On `RegistryProvider` it applies to every atom, and on a hook it applies to that atom and overrides the provider:

```svelte
<RegistryProvider revalidateOnHydrate>{@render children()}</RegistryProvider>
```

```ts
const prices = useAtomSuspense(pricesAtom, { revalidateOnHydrate: true });
```

When several components read the same serializable atom, it runs again if any of them asks.

The atom runs again as the page hydrates, but the hook doesn't wait for it. It resolves with the server's result, marked as waiting, so the page hydrates with what the server rendered. When the browser's result arrives, the component switches to it.

<Example files={[{ html: revalidateSource, name: "revalidate.svelte" }]} hint="Both atoms were in the HTML, computed on the server. The second ran again in the browser: click Reload the page and watch it show the server's result, waiting, until the browser's arrives."> <Revalidate /> </Example>

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

  // Atom.kvs over localStorage, and an in-memory store on the server, which reads "all".
  const saved = useAtomValue(savedFilterAtom);

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const todos = useAtomSuspense(() => todosFor(mounted ? saved.current : "all"));
</script>
```

The first render uses `"all"` on both sides, and hydrates from the server's result. The switch to the saved filter then runs in the browser, like any later switch.

The example saves its filter with `Atom.kvs`, whose server store is in memory, so the server reads `"all"` there too.

<Example files={[{ html: savedFilterSource, name: "saved-filter.svelte" }]} hint="Pick done, then click Reload the page. In the HTML shows the server rendered all three todos; the list then switches to the saved filter, computed in the browser."> <SavedFilter /> </Example>

## HydrationBoundary

Sometimes the data for a page comes from somewhere other than a component's render, such as a `load` function or a remote function. Remote functions need `experimental: { remoteFunctions: true }` in SvelteKit's options. `Hydration.dehydrate` collects the serializable atoms of a registry, and `<HydrationBoundary>` puts them into the browser's registry:

**Example** (Hydrating from a load function)

```ts
// src/routes/todos/+page.server.ts
import { Effect } from "effect";
import { AtomRegistry, Hydration } from "effect/reactivity";

export const load = async () => {
  const registry = AtomRegistry.make();
  // getResult lets go of the atom once its result arrives. The mount keeps it
  // in the registry until dehydrate has read it.
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

<Aside type="caution" title="dehydrate sends defects too">

`Hydration.dehydrate` sends every result its atom's schema can encode. The schema encodes a failure's whole cause, so defects and interruptions are sent with their messages, unlike the hooks' results. In the example above, `Effect.runPromise` rejects when `todosAtom` fails, so `load` throws before it dehydrates. Other serializable atoms in the registry, such as one `todosAtom` reads, are sent whatever their result. To send only results that aren't failures, filter the entries:

```ts
const state = Hydration.toValues(Hydration.dehydrate(registry)).filter(
  (entry) => (entry.value as { _tag?: string })._tag !== "Failure"
);
```

</Aside>

Atoms the browser's registry doesn't have yet are hydrated before the children render. Atoms it already has are updated after the render, so the page on screen doesn't change halfway through a render. On the server, they are updated before the children render too. A value for an atom nothing reads waits in the registry until something does, and is dropped when the boundary goes away. `HydrationBoundary` uses Effect's `Hydration.hydrate`, so unlike the hooks it keeps the registry's behavior of running wrapped atoms again.

The example gets its state from a remote function instead. A `prerender` remote function runs on the server; on this prerendered page that means once, when the site was built, and SvelteKit puts its result in the page. `pricesWithKeysAtom` wraps its effect with `Atom.withReactivity`, so it runs again in the browser.

<Example files={[{ html: hydrationBoundarySource, name: "hydration-boundary.svelte" }, { html: pricesRemoteSource, name: "prices.remote.ts" }, { html: pricesAtomsSource, name: "prices.ts" }, { html: pricesSource, name: "prices.svelte" }]} hint="Both atoms came from the remote function, computed on the server, as In the HTML shows. pricesWithKeysAtom then ran again in the browser: reload the page and watch it switch."> <HydrationBoundaryExample /> </Example>
