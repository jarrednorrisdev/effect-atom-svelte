---
title: Why atoms
description: What atoms add to Svelte, set against the code you'd write without them, and when you don't need them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import AtomsGuide from "#lib/docs/atoms-guide.svelte";
</script>

Runes still handle what belongs to one component, and atoms hold the rest. This is what to reach for when your backend is written in Effect, as Effect RPC or an `HttpApi`:

<AtomsGuide />

The sections below take the atom rows one at a time: the code you'd write without atoms, the atom, and what it costs. Without Effect, you don't need atoms: see [When you don't need atoms](#when-you-dont-need-atoms).

## State shared between components

Take the signed-in user, which a badge in the header and the account menu both show. `currentUser` is your Effect code that finds them, an `Effect<User, SignedOut>`.

In one component, Svelte runs it well on its own. With async rendering you can await it in the script, and `getAbortSignal` interrupts it if the component goes away first:

**Example** (Running an effect in one component)

```svelte
<!-- user-badge.svelte -->
<script lang="ts">
  import { Effect } from "effect";
  import { getAbortSignal } from "svelte";
  import { currentUser } from "$lib/session";

  const user = $derived(
    await Effect.runPromise(currentUser, { signal: getAbortSignal() })
  );
</script>
```

With a second component, each would run the effect. To share one run, you keep the result in a context that the layout sets, start the effect when the first reader mounts, interrupt it when the last one unmounts, and let either refresh it:

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

  /** Each reader calls this in an `$effect`, which runs what it returns on unmount. */
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

// The root layout calls setUser(new UserState()).
export const [getUser, setUser] = createContext<UserState>();
```

```svelte
<!-- user-badge.svelte, and the same in account-menu.svelte -->
<script lang="ts">
  import { getUser } from "$lib/user.svelte";

  const user = getUser();
  $effect(() => user.read());
</script>
```

Even then, an `$effect` doesn't run on the server, so the page renders without the user and fills in after hydration. And the next piece of shared state needs another class and another context in the layout.

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
  import { userAtom } from "$lib/user";

  const user = await useAtomResult(userAtom);
</script>
```

The badge and the menu share one run of the effect, `useAtomRefresh` runs it again for both, and when neither is on the page it's interrupted. The server awaits it too, so the page renders with the user and sends the result along for hydration. The next piece of shared state is one more atom, and the layout doesn't change.

The atom holds no value itself: values live in a **registry**, and the provider gives each request on the server its own, so the server renders each visitor's page with their own data. A `$state` object exported from a module can't do that: see [Module state is shared between visitors](/server-rendering#module-state-is-shared-between-visitors).

**What it costs:** atoms go in a module or a component's `<script module>`, since one made in a component's script is a new atom for each instance. And awaiting them needs Svelte's experimental async mode: see [Turn on async mode](/installation#turn-on-async-mode).

## Data from your Effect backend

Without atoms, each query from your backend is the `UserState` class again, once per query, with the RPC client's layer provided to each effect. With atoms, `AtomRpc` turns the RPC group into queries and mutations, checked against the same schemas as the server:

**Example** (The todo list over Effect RPC)

```ts
// todos.ts
import { TodosRpc } from "./todos-rpc.ts";

export const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
```

`todosAtom` is shared like any atom, awaited on the server, and interrupted when nothing reads it, along with its request. `AtomHttpApi` does the same for an `HttpApi`.

**What it costs:** the client is defined once, with the protocol it speaks to your server. See [RPC](/rpc) and [HTTP API](/http).

## Writing to your backend

Without atoms, the code that runs a mutation refreshes every query it affects, so it has to reach each one:

**Example** (Refreshing by hand after a mutation)

```svelte
<!-- add-todo.svelte -->
<script lang="ts">
  import { Effect, Exit } from "effect";
  import { createTodo } from "$lib/api";
  import { getStats, getTodos } from "$lib/todos.svelte";

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

Every component that creates, edits or deletes a todo carries that list. A query added later, such as one todo by its id, has to be added to each of them.

With atoms, a query tags itself with a key, and a mutation names the key:

**Example** (A mutation that refreshes by key)

```ts
// todos.ts
export const createAtom = TodosRpc.mutation("createTodo");
```

```svelte
<!-- add-todo.svelte -->
<script lang="ts">
  import { useAtomSet } from "effect-atom-svelte";
  import { createAtom } from "$lib/todos";

  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  const add = (title: string) =>
    create({ payload: { title }, reactivityKeys: ["todos"] });
</script>
```

When `createTodo` succeeds, every atom tagged `"todos"` refetches, whether that's the list, the stats or a todo by its id, and every atom derived from them follows. The mutation says what changed, not who reads it, so a query added later only needs its tag.

**What it costs:** the refetch is a second round trip, after the mutation returns. To show the change before then, apply it optimistically: see [Optimistic updates](/mutations#optimistic-updates) and [Refreshing what changed](/mutations#refreshing-what-changed).

## Values derived from other atoms

Without atoms, a getter on a class can combine two pieces of shared state, and Svelte keeps it up to date. What's left to you is passing along the list's loading and failure states, and another context for the class.

With atoms, a filter is an atom of a plain value, and a derived atom reads it next to the list:

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

It runs again when either one changes, including when a mutation refetches the list. It's an `AsyncResult` like the list, so loading and the typed error pass through, and a component awaits it like a query. See [Derived atoms](/derived-atoms).

## Live data

Without atoms, a stream that several components share, such as notifications over a socket, needs the reader counting from `UserState`: open the socket for the first reader, close it after the last.

With atoms, the registry counts readers for you:

**Example** (A stream that two components share)

```ts
// notifications.ts
import { Atom } from "effect/reactivity";

import { notifications } from "./socket.ts";

// notifications is your Stream, which opens a socket and closes it when interrupted.
export const notificationsAtom = Atom.make(notifications);
```

A bell icon and a toast can both read `notificationsAtom`, and they share one stream. When both unmount, the stream is interrupted, the socket closes, and finalizers run.

**What it costs:** an atom that nothing reads loses its value, and starts again from the beginning next time. To keep it, [keep it alive](/lifetimes#keeping-atoms-alive) or give it an idle time. See [Streams](/streams) and [Lifetimes](/lifetimes).

## Errors as values

`Effect.runPromise` throws when the effect fails, so the component gets an `unknown`. You can keep the error typed by hand with `runPromiseExit`, as `UserState` does, at the cost of an `Exit` and a loading state in every class.

An atom holds an `AsyncResult` instead. Over RPC, its error is typed by the procedure's error schema, so a component can tell an expected failure from a dropped connection:

**Example** (Matching on a procedure's error)

```svelte
<!-- todo-title.svelte -->
<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomResult } from "effect-atom-svelte";
  import { TodosRpc } from "$lib/todos-rpc";

  const { id }: { id: number } = $props();

  // getTodo fails with TodoNotFound, or with an RpcClientError if the call itself fails.
  const todo = await useAtomResult(() => TodosRpc.query("getTodo", { id }));
  const error = $derived(AsyncResult.error(todo.current));
</script>

{#if todo.current._tag === "Success"}
  <p>{todo.current.value.title}</p>
{:else if Option.isSome(error) && error.value._tag === "TodoNotFound"}
  <p>There is no todo {id}.</p>
{:else}
  <p>Couldn't reach the server.</p>
{/if}
```

You can match on the result like this, or let a `<svelte:boundary>` show failures. See [Errors](/errors) and [Typed errors from RPC and HTTP APIs](/errors#typed-errors-from-rpc-and-http-apis).

## Services, and swapping them in tests

Effects that need services get them from a `Layer`. `Atom.runtime` takes the layer, and its atoms run with its services:

**Example** (An atom backed by a service)

```ts
import { Atom } from "effect/reactivity";

const runtime = Atom.runtime(TodosLayer);

export const countAtom = runtime.atom(Todos.use((todos) => todos.count));
```

A test gives the runtime a different layer through the provider's `initialValues`, such as a fake API or data held in memory, without mocking any module. See [Services and runtimes](/services) and [Replacing a runtime's layer](/testing#replacing-a-runtimes-layer).

## Why not TanStack Query?

TanStack Query is the closest alternative, and it's mature and widely used. Its invalidation is close to reactivity keys: a mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ["todos"] })`, and every query whose key starts with `"todos"` refetches. For an Effect backend, atoms differ in four ways:

- **Queries are effects.** A query function returns a promise, so each one ends in `Effect.runPromise`, and interruption, services and retries stop at that boundary. An atom runs the effect itself.
- **Errors are typed per query.** TanStack Query gives every query the same error type, `Error` unless you register another. An atom's error is the effect's, or the procedure's.
- **Client state lives alongside.** A derived atom reads a query and a filter alike. TanStack Query's `select` derives only from its own query, and client state lives somewhere else.
- **Unused data goes straight away.** TanStack Query keeps a query nothing reads for its `gcTime`, five minutes by default, as a cache. An atom is disposed of when its last reader goes, unless you give it an idle time or keep it alive.

TanStack Query is ahead on devtools, infinite queries, persisting the cache, and the size of its community. Without Effect, it's the better choice.

## When you don't need atoms

- **Apps without Effect.** Atoms are part of Effect. Without it, context, remote functions or TanStack Query cover shared state well, and learning Effect only for this costs more than it saves.
- **An effect only one component runs.** `Effect.runPromise` with `getAbortSignal` is enough, as in the first example.
- **Route data that doesn't change on the page.** A `load` function is enough.

<Aside type="note" title="Mixing them">

You can mix them. Components can keep local `$state`, read route data from `load`, and use atoms for what they share. To start atoms from `load` data, pass it to `RegistryProvider` as `initialValues`: see [Registry options](/installation#registry-options).

</Aside>
