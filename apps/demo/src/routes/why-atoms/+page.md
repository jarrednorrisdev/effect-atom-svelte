---
title: Why atoms
description: What atoms add to Svelte, set against the code you'd write without them, and when you don't need them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import AtomsGuide from "#lib/docs/atoms-guide.svelte";
</script>

This page answers what to reach for, runes or atoms, in a Svelte app whose backend is written in Effect, such as with Effect RPC (remote procedure calls) or an `HttpApi`. Runes handle what belongs to one component, and atoms handle the rest:

<AtomsGuide />

Each atom row has a section below. Most show the code you'd write without atoms, then the atom, and say what it costs. Two more sections cover services and TanStack Query. Without Effect, you don't need atoms: see [When you don't need atoms](#when-you-dont-need-atoms).

## State shared between components

Take the signed-in user, which a badge in the header and the account menu both show. `currentUser` is your Effect code that finds them, an `Effect<User, SignedOut>`.

In one component, Svelte needs nothing more. With [async rendering](/installation#turn-on-async-mode) you can await it in the script, and `getAbortSignal` interrupts it if the component goes away first:

**Example** (Running an effect in one component)

```svelte
<!-- user-badge.svelte -->
<script lang="ts">
  import { Effect } from "effect";
  import { getAbortSignal } from "svelte";
  import { currentUser } from "#lib/session";

  const user = $derived(
    await Effect.runPromise(currentUser, { signal: getAbortSignal() })
  );
</script>
```

With a second component, each would run the effect. To share one run, you'd write the sharing yourself:

- Keep the result in a context that the root layout sets.
- Start the effect when the first reader mounts.
- Interrupt it when the last reader unmounts.
- Let any reader refresh it.

**Example** (Sharing the user by hand)

```ts
// user.svelte.ts
import { Effect, type Exit } from "effect";
import { createContext } from "svelte";

import { currentUser, type SignedOut, type User } from "./session.ts";

export class UserState {
  exit = $state<Exit.Exit<User, SignedOut>>();
  #controller: AbortController | undefined;
  #readers = 0;

  /** Call in each reader's `$effect`. It returns the cleanup. */
  read() {
    this.#readers += 1;
    if (this.#readers === 1) void this.refresh();
    return () => {
      this.#readers -= 1;
      if (this.#readers === 0) this.#controller?.abort();
    };
  }

  async refresh() {
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    const exit = await Effect.runPromiseExit(currentUser, {
      signal: controller.signal,
    });
    if (!controller.signal.aborted) this.exit = exit;
  }
}

export const [getUser, setUser] = createContext<UserState>();
```

The root layout calls `setUser(new UserState())`, and each reader calls `read`:

```svelte
<!-- user-badge.svelte, and the same in account-menu.svelte -->
<script lang="ts">
  import { getUser } from "#lib/user.svelte";

  const user = getUser();
  $effect(() => user.read());
</script>
```

Even then, an `$effect` doesn't run on the server, so the page renders without the user and fills in after [hydration](/hydration). And the next piece of shared state needs another class and another context in the layout.

With atoms, the effect goes in a module, one provider goes in the root layout, and any component reads the atom:

**Example** (The signed-in user as an atom)

```ts
// user.ts
import { Atom } from "effect/reactivity";

import { currentUser } from "./session.ts";

export const userAtom = Atom.make(currentUser);
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>
  {@render children()}
</RegistryProvider>
```

```svelte
<!-- user-badge.svelte, and the same in account-menu.svelte -->
<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";
  import { userAtom } from "#lib/user";

  const user = await useAtomResult(userAtom);
</script>
```

The badge and the menu share one run of the effect. `useAtomRefresh` runs it again for both. When neither is on the page, the registry disposes of the atom, and interrupts the effect if it is still running. The next piece of shared state is one more atom, and the layout doesn't change.

The server awaits the atom too, so the page renders with the user. Make the atom [serializable](/hydration#serializable-atoms) and the server sends its result with the page, so the browser doesn't run the effect again.

Values live in a **registry**, not in the atom. The provider gives each request on the server its own registry, so the server renders each visitor's page with their own data. A `$state` object exported from a module can't do that: see [Module state is shared between visitors](/server-rendering#module-state-is-shared-between-visitors).

**What it costs:** atoms go in a module or a component's `<script module>`. One made in a component's script is a new atom for each instance. Awaiting them also needs Svelte's experimental async mode: see [Turn on async mode](/installation#turn-on-async-mode).

## Data from your Effect backend

A query atom reads your backend through a client typed by the server's schemas. Without atoms, each query is the `UserState` class again, with the RPC client's layer provided to each effect. `AtomRpc` instead turns your RPC group into queries and mutations that use the server's own schemas:

**Example** (The todo list over Effect RPC)

```ts
// todos.ts
import { TodosRpc } from "./todos-rpc.ts";

export const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
```

Components share `todosAtom` like any atom. The server awaits it. When nothing reads it, the registry disposes of it, and cancels its request if it is still in flight. `AtomHttpApi` does the same for an `HttpApi`.

**What it costs:** you define the client once, with the protocol it uses to reach your server. See [RPC](/rpc) and [HTTP API](/http).

## Writing to your backend

Without reactivity keys, every mutation lists the queries it affects, and the code that runs it has to reach each one:

**Example** (Refreshing by hand after a mutation)

```svelte
<!-- add-todo.svelte -->
<script lang="ts">
  import { Effect, Exit } from "effect";
  import { createTodo } from "#lib/api";
  import { getStats, getTodos } from "#lib/todos.svelte";

  const todos = getTodos();
  const stats = getStats();

  const add = async (title: string) => {
    const exit = await Effect.runPromiseExit(createTodo({ title }));
    if (Exit.isSuccess(exit)) {
      void todos.refresh();
      void stats.refresh();
    }
  };
</script>
```

Every mutation has to know which queries read what it changed. You can gather that list in one helper, but the helper still names every reader, and a query you add later, such as one todo by its id, has to be added to it.

**Reactivity keys** turn that around. You tag each query with a key, and the mutation names the key it changed:

**Example** (A mutation that refreshes by key)

```ts
// todos.ts
export const createAtom = TodosRpc.mutation("createTodo");
```

```svelte
<!-- add-todo.svelte -->
<script lang="ts">
  import { useAtomSet } from "effect-atom-svelte";
  import { createAtom } from "#lib/todos";

  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  const add = (title: string) =>
    create({ payload: { title }, reactivityKeys: ["todos"] });
</script>
```

When `createTodo` succeeds, every atom tagged `"todos"` refetches: the list, the stats, a todo by its id. Atoms derived from them update too. The mutation names what changed, not who reads it, so a query added later only needs its tag.

**What it costs:** the refetch is a second round trip, after the mutation returns. To show the change before then, apply it optimistically: see [Optimistic updates](/mutations#optimistic-updates) and [Refreshing what changed](/mutations#refreshing-what-changed).

## Values derived from other atoms

A derived atom combines other atoms, whether they hold backend data or client state. Without atoms, a getter on a class can combine two pieces of shared state, and Svelte keeps it up to date. But each getter passes along the list's loading and failure states itself.

As atoms, a filter is a plain value, and a derived atom reads it next to the list:

**Example** (A filter, and the todos it lets through)

```ts
// todos.ts
import { AsyncResult, Atom } from "effect/reactivity";

export const filterAtom = Atom.make<"all" | "open">("all");

export const visibleTodosAtom = Atom.make((get) => {
  const filter = get(filterAtom);
  return get(todosAtom).pipe(
    AsyncResult.map((todos) =>
      filter === "all" ? todos : todos.filter((todo) => !todo.done)
    )
  );
});
```

`visibleTodosAtom` runs again when either one changes, including when a mutation refetches the list. It's an [`AsyncResult`](/async-atoms) like the list, so loading and the typed error pass through. A component awaits it like a query. See [Derived atoms](/derived-atoms).

## Live data

A stream atom starts when the first component reads it, and stops after the last one goes. Without atoms, a shared stream, such as notifications over a socket, needs the reader counting from `UserState`.

As an atom, the stream needs no counting code:

**Example** (A stream that two components share)

```ts
// notifications.ts
import { Atom } from "effect/reactivity";

import { notifications } from "./socket.ts";

// Your Stream: it opens a socket, and closes it when interrupted.
export const notificationsAtom = Atom.make(notifications);
```

A bell icon and a toast can both read `notificationsAtom`, and they share one stream. When both unmount, the stream is interrupted, the socket closes, and finalizers run.

**What it costs:** an atom that nothing reads loses its value, and starts again from the beginning next time. To keep it, [keep it alive](/lifetimes#keeping-atoms-alive) or give it an idle TTL. See [Streams](/streams) and [Lifetimes](/lifetimes).

## Errors as values

An atom's failure arrives as a typed value, not a thrown error. `Effect.runPromise` throws, so the component gets an `unknown`. You can keep the error typed by hand with `runPromiseExit`, as `UserState` does, but then every class needs an `Exit` and a loading state.

Each async atom stores an `AsyncResult` instead. Over RPC, the error type comes from the procedure's error schema, so a component can tell an expected failure from a dropped connection. Here `getTodo` fails with `TodoNotFound`, or with an `RpcClientError` when the call itself fails:

**Example** (Matching on a procedure's error)

```svelte
<!-- todo-title.svelte -->
<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomResult } from "effect-atom-svelte";
  import { TodosRpc } from "#lib/todos-rpc";

  const { id }: { id: number } = $props();

  const todo = await useAtomResult(() => TodosRpc.query("getTodo", { id }));
  const error = $derived(AsyncResult.error(todo.current));
</script>

{#if todo.current._tag === "Success"}
  <p>{todo.current.value.title}</p>
{:else if Option.isSome(error) && error.value._tag === "TodoNotFound"}
  <p>There is no todo {id}.</p>
{:else if Option.isSome(error) && error.value._tag === "RpcClientError"}
  <p>Couldn't reach the server.</p>
{:else}
  <!-- A defect: something failed that the type doesn't describe. -->
  <p>Something went wrong.</p>
{/if}
```

You can match on the result like this, or let a `<svelte:boundary>` show failures. See [Errors](/errors) and [Typed errors from RPC and HTTP APIs](/errors#typed-errors-from-rpc-and-http-apis).

## Services, and swapping them in tests

Effects that need services get them from a [`Layer`](/effect-basics#services-and-layers). Without atoms, you'd provide the layer in every `runPromise` call, and a test would mock the module that builds it.

`Atom.runtime` takes the layer once, and atoms made from it run with its services. Here `Todos` is a service and `TodosLayer` builds it:

**Example** (An atom backed by a service)

```ts
import { Atom } from "effect/reactivity";

const runtime = Atom.runtime(TodosLayer);

export const countAtom = runtime.atom(Todos.use((todos) => todos.count));
```

A test gives the runtime a different layer, such as a fake API or data held in memory. The layer goes in the provider's `initialValues`, and no module needs mocking. See [Services and runtimes](/services) and [Replacing a runtime's layer](/testing#replacing-a-runtimes-layer).

## Why not TanStack Query?

TanStack Query is the closest alternative, with a long track record and a large community. Its invalidation is close to reactivity keys. A mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ["todos"] })`. Every query whose key starts with `"todos"` is marked stale, and the ones on screen refetch. For an Effect backend, atoms differ in four ways:

- **Queries are effects.** A TanStack Query function returns a promise, so each one ends in `Effect.runPromise`. You can pass its `signal` along and provide services there, but you write that glue yourself, in each query or in a helper. An atom runs the effect itself.
- **Error types are checked.** TanStack Query types a query's error as `Error` unless you register another type or pass one per query, and either way it's an assertion: nothing checks what the query function throws. An atom's error type is inferred from the effect, or from the procedure's schema.
- **Client state lives alongside.** A derived atom reads a query and a filter alike. TanStack Query can combine queries, but client state lives outside it, in a store or a context.
- **Unused data goes straight away.** TanStack Query keeps a query nothing reads for its `gcTime`, five minutes by default, as a cache. The registry disposes of an atom when its last reader goes, unless you give it an idle TTL or keep it alive.

TanStack Query is ahead on devtools, infinite queries (refetching every loaded page, and loading in both directions), persisting the cache, and the size of its community. Without Effect, it's the better choice.

## When you don't need atoms

Three cases don't need atoms:

- **Apps without Effect.** Effect Atom is part of the `effect` package. Without it, context, remote functions or TanStack Query share state between components, and learning Effect only for this costs more than it saves.
- **An effect only one component runs.** `Effect.runPromise` with `getAbortSignal` is enough, as in the first example.
- **Route data that doesn't change on the page.** A `load` function is enough.

<Aside type="note" title="Mixing them">

You can mix them. Components can keep local `$state`, read route data from `load`, and use atoms for what they share. Atoms can also start from `load` data: see [Starting atoms from request data](/sveltekit#starting-atoms-from-request-data).

</Aside>
