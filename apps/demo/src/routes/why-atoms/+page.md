---
title: Why atoms
description: What atoms solve that module state, stores and load functions don't, and when you don't need them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

Svelte 5 already has reactive state that works anywhere: `$state` in a `.svelte.ts` module. This page starts from that, shows where it breaks, and what atoms do about it. It ends with the cases where you don't need atoms at all.

In short, atoms give you what runes alone don't:

- A typed client for your Effect RPC or `HttpApi` backend.
- Mutations that refetch the queries they affect, via reactivity keys.
- Per-request isolation, from one `RegistryProvider`.
- Any `Effect` or `Stream` in a component, with typed errors and interruption.

If you need none of these, see [When you don't need atoms](#when-you-dont-need-atoms).

## State shared between components

Say several components need the signed-in user. The shortest way is a module:

**Example** (Module state, set from layout data)

```ts
// user.svelte.ts
export const user = $state({ name: "" });
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { user } from "$lib/user.svelte";

  const { children, data } = $props();
  user.name = data.user.name;
</script>

{@render children()}
```

In the browser this works. On the server it doesn't: a module is loaded once per server process, so every request shares the same `user`. A page that doesn't set it shows whoever was rendered last. With async rendering it is worse, because requests take turns at each `await`: one visitor's render can pick up the name another visitor's request has just set. [Module state is shared between visitors](/server-rendering#module-state-is-shared-between-visitors) walks through the leak, and when module state is safe.

### What Svelte and SvelteKit offer

The fix Svelte recommends is context: create the state once per request in the root layout, and read it in components. `createContext` gives you a typed getter and setter in one line, so each piece of state costs little.

For data from the server, SvelteKit's remote functions go further. A `query` runs once per request on the server however many components call it, its result is sent with the page so the browser doesn't fetch it again, and in the browser it is cached by its arguments, with `loading`, `error` and `refresh()`. With a `getUser` query, the example above needs no shared state at all.

So for server data, SvelteKit already does a lot. Where you still write things by hand is the state components share that doesn't come from the server, such as a filter, a draft or a selected item: each one needs its own context set up in a layout, and it stays in memory for as long as the app is open, whether or not anything still shows it.

None of these tools works with Effect directly, either. Inside a remote function you run the effect yourself, and its typed errors reach the component as thrown errors, so the component can't match on them. An atom takes an `Effect` or a `Stream` as it is, and components get its typed result.

### With atoms

Atoms give all shared state that isolation at once, whether it comes from the server or not. An atom is a description and holds no value, so it can live in a module. Values live in a **registry**, and one `RegistryProvider` in the root layout gives each request its own, for every atom.

Here is the signed-in user again, this time loaded by your Effect code:

**Example** (The signed-in user as an atom that runs an Effect)

```ts
// user.ts
import { Atom } from "effect/reactivity";

import { currentUser } from "./session.ts";

// currentUser is your Effect code that finds the signed-in user. Its type,
// Effect<User, SignedOut>, says it can fail with a typed SignedOut error.
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
<!-- user-badge.svelte -->
<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomResult } from "effect-atom-svelte";
  import { userAtom } from "$lib/user";

  const user = await useAtomResult(userAtom);
  // The typed error, SignedOut, if the effect failed with one.
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

Next to a `getUser` remote query, the difference is the Effect code: `currentUser` is used as it is, and a failure reaches the component as a typed `SignedOut`, not a thrown error, so the badge can tell a signed-out visitor from a defect. Effect code that needs services, such as an HTTP client, gets them from a [runtime](/services). Made [serializable](/hydration#serializable-atoms), the atom sends the server's result with the page, as a remote query does.

The same `RegistryProvider` isolates client state too, such as a filter or a draft, with no setup per atom. In the browser one registry lasts for the session, so that state is shared just as the module version was. One difference: the registry disposes of an atom nothing [holds](/reading-and-writing#reading), so its value starts again from the beginning next time, unless you [keep it alive](/lifetimes#keeping-atoms-alive).

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

SvelteKit's remote functions can refresh queries after a mutation too, in the same request. But each form or command has to name the queries it affects, with `refresh()` on the server or `updates()` in the browser. A reactivity key decouples the two: the mutation says what it changed, and any query tagged with that key, written before or after it, refetches.

[RPC](/rpc) and [HTTP API](/http) cover the clients, with live examples, and [Refreshing what changed](/mutations#refreshing-what-changed) covers reactivity keys.

## What else atoms handle

Per-request isolation is the problem a module can't solve. Beyond it, atoms bring your Effect code into components and handle the work around shared state. Some of it overlaps with remote functions for server data; the difference is that atoms do it for Effect code, and for client state too.

- **Effect in components.** An atom takes an `Effect` or a `Stream` as it is, and can use services from a `Layer`. See [Services and runtimes](/services). For RPC and `HttpApi` clients, see [Talking to an Effect backend](#talking-to-an-effect-backend).
- **Async state with typed errors.** An atom built from an `Effect` holds an `AsyncResult`: `Initial` before the first value, `Success` or `Failure` after, with the error typed by the effect. The hooks hand that to `<svelte:boundary>`, or let you match on it. See [Async atoms](/async-atoms).
- **Derived values.** `Atom.make((get) => ...)` reads other atoms, from any module, whether they hold server data or client state, and the registry computes it again only when one of them changes. See [Derived atoms](/derived-atoms).
- **Cleanup.** When nothing holds an atom, the registry disposes of it: its effect is interrupted, a stream stops, and finalizers run. If a component unmounts mid-request and nothing else holds the atom, its effect is interrupted. The request itself is aborted if the effect passes on its `AbortSignal`: see [Wrapping a promise](/effect-basics#wrapping-a-promise). State in context, by contrast, lasts as long as the layout that created it. In exchange, an atom nothing holds loses its value unless you keep it alive. See [Lifetimes](/lifetimes).
- **Server data in the browser.** As with a remote `query`, serializable async atoms awaited during server rendering pass their results to the browser, which uses them instead of running the effects again. See [Hydration](/hydration).

## When you don't need atoms

- **State one component owns.** A form field or an open menu is `$state` in that component.
- **Apps without Effect.** Atoms are part of Effect. Without it, context and remote functions cover shared state well, and learning Effect only for this costs more than it saves.
- **Route data that doesn't change on the page.** A `load` function is enough.
- **Server data that components only read and refresh.** A remote `query` already handles requests, loading, errors and caching. Atoms earn their place when that data comes from Effect code, when you want its errors typed, or when client state is derived from it.

<Aside type="note" title="Mixing them">

You can mix them. Components can keep local `$state`, read route data from `load` or remote functions, and use atoms for the state they share and for the Effect code behind it. To start atoms from `load` data, pass it to `RegistryProvider` as `initialValues`: see [Registry options](/installation#registry-options).

</Aside>
