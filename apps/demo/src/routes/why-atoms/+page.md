---
title: Why atoms
description: What atoms add to Svelte for apps written with Effect, and when you don't need them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

Atoms are for Svelte apps whose logic is written in Effect. They let components share the results of Effect code, typed, cleaned up and refreshed, with no context or cache to write for each piece:

- **Shared without wiring.** An atom is defined once, in a plain module, and read in any component. One `RegistryProvider` in the root layout keeps each request separate.
- **Errors you can match on.** A failure reaches the component as the effect's typed error, not a thrown one.
- **Cleanup when unused.** When nothing reads an atom, its effect is interrupted and its stream stops.
- **A typed client for an Effect backend.** Queries and mutations for Effect RPC or an `HttpApi`, where a mutation refreshes the queries it affects by key.

Without Effect, you don't need atoms: see [When you don't need atoms](#when-you-dont-need-atoms).

## Sharing Effect results between components

In one component, Svelte runs an effect well on its own. With async rendering you can await it in the script, and `getAbortSignal` interrupts it if the component goes away first:

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

It stops working once a second component needs the user. Each one would run the effect again, so you'd keep the result in a context, set in a layout above both. Then you'd add a way to run it again when the user changes, and to interrupt it only when the last reader goes away. And you'd write all that again for the next piece of shared state.

With atoms, the effect goes in a module, and any component reads it:

**Example** (The signed-in user as an atom)

```ts
// user.ts
import { Atom } from "effect/reactivity";

import { currentUser } from "./session.ts";

// currentUser is your Effect code that finds the signed-in user.
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

The badge and the menu share one run of the effect, and refreshing it, with `useAtomRefresh`, runs it again for both. The atom holds no value itself: values live in a **registry**, and the provider gives each request on the server its own, so this is as safe as context. The next piece of shared state is one more atom, and the layout doesn't change. A `$state` object exported from a module would not be safe there: see [Module state is shared between visitors](/server-rendering#module-state-is-shared-between-visitors).

If the user comes from your server, a remote `query` that runs `currentUser` would share it between components too, and send its result with the page. What it can't do is hand the component a typed failure, which is the next section. Atoms also run effects that belong in the browser, and send results with the page when they're [serializable](/hydration#serializable-atoms).

## Errors you can match on

`Effect.runPromise` throws when the effect fails, and so does a remote function, so the component gets an `unknown` and can't tell an expected failure from a bug. An atom holds an `AsyncResult` instead, with the error typed by the effect:

**Example** (Matching on a typed error)

```svelte
<!-- user-badge.svelte -->
<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomResult } from "effect-atom-svelte";
  import { userAtom } from "$lib/user";

  // currentUser is Effect<User, SignedOut>, so a failure can be a SignedOut.
  const user = await useAtomResult(userAtom);
  const signedOut = $derived(AsyncResult.error(user.current));
</script>

{#if user.current._tag === "Success"}
  <p>Signed in as {user.current.value.name}</p>
{:else if Option.isSome(signedOut)}
  <a href="/sign-in">Sign in</a>
{:else}
  <!-- A defect: something failed that the effect's type doesn't describe. -->
  <p>Couldn't load your account.</p>
{/if}
```

You can match on the result like this, or let a `<svelte:boundary>` show failures. See [Async atoms](/async-atoms) and [Errors](/errors).

## Cleanup when nothing reads it

In one component, an `$effect`'s teardown or `getAbortSignal` stops the work when the component goes away. When several components share the work, such as a socket, it should stop only when the last of them goes. That takes counting readers, and the registry does it:

**Example** (A stream that two components share)

```ts
// notifications.ts
import { Atom } from "effect/reactivity";

import { notifications } from "./socket.ts";

// notifications is your Stream, which opens a socket and closes it when interrupted.
export const notificationsAtom = Atom.make(notifications);
```

A bell icon and a toast can both read `notificationsAtom`, and they share one stream. When both unmount, the registry disposes of the atom: the stream is interrupted, the socket closes, and finalizers run. An effect is interrupted the same way, and so is its request if the effect passes on its `AbortSignal`: see [Wrapping a promise](/effect-basics#wrapping-a-promise).

The trade-off is that an atom nothing holds loses its value, and starts again from the beginning next time. To keep it, [keep it alive](/lifetimes#keeping-atoms-alive). See [Streams](/streams) and [Lifetimes](/lifetimes).

## Client state, and state derived from both

For client state alone, such as a filter or a draft, Svelte has a good answer: a class with `$state` fields, in one context set in the root layout. If that's all your shared state is, you don't need atoms for it.

What atoms add is client state that sits next to your Effect state and can be derived from it. An atom of client state is a plain value, and a derived atom can read any atom, from any module:

**Example** (A filter, and the todos it lets through)

```ts
// todos.ts
import { AsyncResult, Atom } from "effect/reactivity";

export const filterAtom = Atom.make<"all" | "open">("all");

// todosAtom fetches the list. The derived atom runs again when either one changes.
export const visibleTodosAtom = Atom.make((get) => {
  const filter = get(filterAtom);
  return get(todosAtom).pipe(
    AsyncResult.map((todos) =>
      filter === "all" ? todos : todos.filter((todo) => !todo.done)
    )
  );
});
```

Both are created when a component first reads them, not up front in a layout, and the list keeps its typed error. See [Derived atoms](/derived-atoms).

## Talking to an Effect backend

If your server is Effect RPC or an `HttpApi`, atoms give components a typed client for it. `AtomRpc` turns the RPC group into queries and mutations, using the same schemas as the server:

**Example** (A todo list over Effect RPC)

```ts
// todos.ts
import { TodosRpc } from "./todos-rpc.ts";

export const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
export const createAtom = TodosRpc.mutation("createTodo");
```

```svelte
<!-- todo-list.svelte -->
<script lang="ts">
  import { useAtomResult, useAtomSet } from "effect-atom-svelte";
  import { createAtom, todosAtom } from "$lib/todos";

  const todos = await useAtomResult(todosAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  const add = (title: string) =>
    create({ payload: { title }, reactivityKeys: ["todos"] });
</script>
```

The payload and result are checked against the RPC's schemas, and a failure arrives typed: a title that's too long comes back as the procedure's `TitleTooLong`, not a thrown error. When `createTodo` succeeds, every atom tagged `"todos"` runs again, along with anything derived from it, so there are no refresh calls to write by hand. `AtomHttpApi` does the same for an `HttpApi`.

If your Effect code runs inside SvelteKit, remote functions that call it are a real alternative. They can refresh queries after a mutation too, in the same request, but each form or command has to name the queries it affects, with `refresh()` on the server or `updates()` in the browser, and failures arrive thrown. A reactivity key decouples the two: the mutation says what it changed, and any query tagged with that key refetches. With a separate Effect server, remote functions would only pass calls through to it.

[RPC](/rpc) and [HTTP API](/http) cover the clients, with live examples, and [Refreshing what changed](/mutations#refreshing-what-changed) covers reactivity keys.

## Also included

- [Services and runtimes](/services): effects that need services get them from a `Layer`, which tests can swap.
- [Server rendering](/server-rendering) and [Hydration](/hydration): atoms awaited on the server send their results with the page.
- [Families](/families): one atom per key, such as a todo by id.
- [Scoped atoms](/scoped-atoms): an atom with its own value for each part of the page.
- [Browser atoms](/browser): state kept in `localStorage`, a cookie or the URL.

## When you don't need atoms

- **State one component owns.** A form field or an open menu is `$state` in that component.
- **Apps without Effect.** Atoms are part of Effect. Without it, context and remote functions cover shared state well, and learning Effect only for this costs more than it saves. If you do use Effect, the backend can be anything: wrap a plain `fetch` with `Effect.tryPromise` and you still get typed errors, retries and interruption.
- **An effect that one component runs.** `Effect.runPromise` with `getAbortSignal` is enough, as in the first example.
- **Client state with no Effect behind it.** A class with `$state` fields in a root context is enough.
- **Route data that doesn't change on the page.** A `load` function is enough.
- **Server data that components only read and refresh.** A remote `query` already handles requests, loading, errors and caching. Atoms earn their place when that data comes from Effect code, when you want its errors typed, when client state is derived from it, or when mutations should refresh it by key.

<Aside type="note" title="Mixing them">

You can mix them. Components can keep local `$state`, read route data from `load` or remote functions, and use atoms for the state they share and for the Effect code behind it. To start atoms from `load` data, pass it to `RegistryProvider` as `initialValues`: see [Registry options](/installation#registry-options).

</Aside>
