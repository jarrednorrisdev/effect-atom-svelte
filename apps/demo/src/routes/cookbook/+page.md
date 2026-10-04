---
title: Cookbook
description: Recipes for common tasks, from route params and infinite scroll to sockets and auth headers.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Feed from "./feed.svelte";
  import feedSource from "./feed.svelte?highlight";
  import FirstOpen from "./first-open.svelte";
  import firstOpenSource from "./first-open.svelte?highlight";
  import NewTodo from "./new-todo.svelte";
  import newTodoSource from "./new-todo.svelte?highlight";
  import Polling from "./polling.svelte";
  import pollingSource from "./polling.svelte?highlight";
  import Search from "./search.svelte";
  import searchSource from "./search.svelte?highlight";
  import todosSource from "./todos.ts?highlight";
</script>

Each recipe on this page solves one common task with the pieces from the rest of the guide. The live ones call the same demo server as the [RPC](/rpc) page, so a todo you add in one shows up in the others.

## A route param that picks the query

A page such as `/todos/[id]` shows one item, chosen by the URL. Read the param inside a getter, so the hook follows it:

**Example** (A todo page driven by its route param)

```svelte
<!-- src/routes/todos/[id]/+page.svelte -->
<script lang="ts">
  import { page } from "$app/state";
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosRpc } from "../../clients.ts";

  const todo = useAtomSuspense(() =>
    TodosRpc.query(
      "getTodo",
      { id: Number(page.params.id) },
      { serializationKey: `todo-${page.params.id}` }
    )
  );
</script>

<svelte:boundary>
  <h1>{(await todo.current).title}</h1>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
```

When you navigate from `/todos/1` to `/todos/2`, SvelteKit keeps the page component and changes `page.params`. The getter then returns the query for the new id, and the boundary awaits it. A query called with the same arguments returns the same atom, so going back to `/todos/1` reuses that atom if it is still in the registry.

For atoms of your own, put the param into an [`Atom.family`](/families) the same way: `useAtomSuspense(() => todoAtom(Number(page.params.id)))`. The [RPC page](/rpc#following-arguments) has a live version driven by a `<select>`.

## Dependent queries

Sometimes one request needs the result of another, such as fetching a todo's details once the list tells you its id. Write an atom that reads the first atom with `get.result`, which waits for its value, and then makes the second request:

<Example files={[{ html: firstOpenSource, name: "first-open.svelte" }, { html: todosSource, name: "todos.ts" }]}> <FirstOpen /> </Example>

`get.result` fails the atom if the list fails, so the error reaches the component without any extra code. Because the atom read `todosAtom`, it runs again when the list changes. Click **Done**: the mutation invalidates `"todos"`, the list is fetched again, and the atom moves on to the next open todo.

If the second request only needs a value the component already has, a getter is enough: `useAtomValue(() => TodosRpc.query("getTodo", { id: selected }))`.

## Infinite scroll

A [pull atom](/streams#pull-atoms) loads one page each time you write to it. Write to it when an element at the end of the list scrolls into view:

<Example files={[{ html: feedSource, name: "feed.svelte" }]}> <Feed /> </Example>

The `IntersectionObserver` lives in an [attachment](https://svelte.dev/docs/svelte/@attach), which disconnects it when the element goes away. The `{#key}` block makes a new element after each page. If the end of the list is still in view, the new observer pulls again straight away.

With an API that takes a cursor, build the stream with `Stream.paginate` around the request, as the example does, and return the next cursor with each page.

## A form with typed errors and an optimistic update

This form adds a todo. It shows the todo straight away, shows the server's typed error if the title is too long, and removes the todo again when the save fails. Try a title longer than 60 characters:

<Example files={[{ html: newTodoSource, name: "new-todo.svelte" }, { html: todosSource, name: "todos.ts" }]}> <NewTodo /> </Example>

Three pieces work together:

- **`Atom.optimistic` and `Atom.optimisticFn`** show the provisional list while the mutation runs. When it succeeds, the optimistic atom fetches `todosAtom` again, so the mutation doesn't need `reactivityKeys`. See [Optimistic updates](/mutations#optimistic-updates).
- **`mode: "promiseExit"`** gives the submit handler the mutation's `Exit`, which never rejects.
- **`Cause.findErrorOption`** takes the first typed error out of the cause. Its type is the procedure's errors plus `RpcClientError`, so checking `_tag` narrows it to `TitleTooLong` and its `maxLength`.

To check a form before sending anything, decode its fields with a `Schema` in the submit handler, and show the issues the same way.

## Polling

To fetch something again on a timer, refresh it whenever a signal atom changes. `Atom.makeRefreshOnSignal` does that, and the signal can be any atom:

<Example files={[{ html: pollingSource, name: "polling.svelte" }]}> <Polling /> </Example>

The timer runs only while something reads the polled atom. When the last reader goes, the registry disposes of the signal and its finalizer clears the interval. Add a todo in the form above, and the count catches up on the next tick. `Atom.refreshOnWindowFocus` works the same way, with the tab becoming visible as its signal (see [Browser atoms](/browser#refreshing-when-the-tab-comes-back)).

## A WebSocket or server-sent events

A socket pushes messages whenever it likes. `Stream.callback` turns that into a stream: it hands you a queue, and you offer each message to it. An atom made from the stream holds the latest value:

**Example** (Collecting a socket's messages)

```ts
import { Effect, Queue, Stream } from "effect";
import { Atom } from "effect/reactivity";

const messages = Stream.callback<string>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const socket = new WebSocket("wss://example.com/feed");
      socket.addEventListener("message", (event) => {
        Queue.offerUnsafe(queue, String(event.data));
      });
      socket.addEventListener("close", () => Queue.endUnsafe(queue));
      return socket;
    }),
    (socket) => Effect.sync(() => socket.close())
  )
);

export const messagesAtom = Atom.make(
  messages.pipe(
    Stream.scan(
      () => [] as string[],
      (all, message) => [...all, message]
    )
  )
).pipe(Atom.withServerValueInitial);
```

The socket opens when something first reads `messagesAtom`. When the last reader goes, the registry stops the stream, which closes the scope, and the release closes the socket. `Stream.scan` keeps every message so far rather than only the latest. `Atom.withServerValueInitial` keeps the socket closed on the server, where it has nothing to show.

Server-sent events work the same way with an `EventSource`: listen for `message`, offer `event.data`, and call `source.close()` in the release.

<Aside type="tip" title="Streaming RPC">

If the server speaks Effect RPC, a procedure declared with `stream: true` gives you a stream atom without writing the socket code. See [Streaming procedures](/rpc#streaming-procedures).

</Aside>

## Auth headers

To add a header to every request, give the client a `transformClient` function. It takes the `HttpClient` and returns one that changes each request before it is sent:

**Example** (A bearer token on every HTTP API request)

```ts
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { AtomHttpApi } from "effect/reactivity";

import { TodosApi } from "./api.ts";
import { readToken } from "./auth.ts";

export class TodosHttp extends AtomHttpApi.Service<TodosHttp>()(
  "app/TodosHttp",
  {
    api: TodosApi,
    httpClient: FetchHttpClient.layer,
    transformClient: HttpClient.mapRequest((request) =>
      HttpClientRequest.bearerToken(request, readToken())
    ),
  }
) {}
```

`mapRequest` runs for each request, so `readToken` is called every time and a new token is picked up without rebuilding the client. `RpcClient.layerProtocolHttp` takes a `transformClient` option too, for an `AtomRpc` client.

To add a header to one request only, pass `headers`. RPC queries and mutations take it, and so does an HTTP API request.

<Aside type="caution" title="The client is shared on the server">

A client defined at module level serves every request the server renders. Don't keep a visitor's token in module state there, or another visitor's render could send it. A session cookie on the same origin needs no code in the browser, because `fetch` sends it.

</Aside>

## Debounced search

A search box shouldn't send a request for every key press. `Atom.debounce` follows another atom once it has stopped changing for a while, and an async atom that reads it runs once per pause. Here the query also lives in the URL, through `Atom.searchParam`:

<Example files={[{ html: searchSource, name: "search.svelte" }]}> <Search /> </Example>

When the debounced query changes while a search is still running, the atom runs again and interrupts the old search, so an old result never lands over a new one. [Browser atoms](/browser#the-urls-query-string) covers `Atom.searchParam`, including what the server sees.

## Atoms outside components

Atoms are plain values, so you can define them in any module. Their state lives in a registry, and there are three ways to get at one outside a component's markup.

### In a `.svelte.ts` class

The hooks need a component's context, but not its markup. A class that calls them in its constructor works, as long as a component creates it while it initializes:

**Example** (A form's state and actions in a class)

```ts
// todo-form.svelte.ts
import { Exit } from "effect";
import { useAtomSet, useAtomValue } from "effect-atom-svelte";

import { TodosRpc } from "./clients.ts";

const createAtom = TodosRpc.mutation("createTodo");

export class TodoForm {
  title = $state("");
  readonly saving = useAtomValue(createAtom);
  readonly #create = useAtomSet(createAtom, { mode: "promiseExit" });

  submit = async () => {
    const exit = await this.#create({ payload: { title: this.title } });
    if (Exit.isSuccess(exit)) {
      this.title = "";
    }
  };
}
```

```svelte
<script lang="ts">
  import { TodoForm } from "./todo-form.svelte.ts";

  const form = new TodoForm();
</script>
```

Create it at the top level of the script, not in an event handler or after an `await` inside a function, for the same reason as any hook.

### The registry itself

`getRegistry()` returns the registry the hooks use. Call it while the component initializes, and keep the result for later, for example to read or write an atom from code that isn't reactive:

```ts
const registry = getRegistry();

const save = () => {
  const draft = registry.get(draftAtom);
  registry.update(historyAtom, (history) => [...history, draft]);
};
```

It has `get`, `set`, `update`, `refresh`, `subscribe` and `mount`, among others. A value written to an atom that nothing mounts is disposed shortly afterwards. See [Lifetimes](/lifetimes).

### In a load function

A `load` function runs outside any component, so it makes a registry of its own, and disposes of it when it is done. `AtomRegistry.getResult` waits for an async atom's result as an `Effect`:

```ts
// src/routes/todos/+page.server.ts
import { Effect } from "effect";
import { AtomRegistry } from "effect/reactivity";

export const load = async () => {
  const registry = AtomRegistry.make();
  try {
    const todos = await Effect.runPromise(
      AtomRegistry.getResult(registry, todosAtom)
    );
    return { count: todos.length };
  } finally {
    registry.dispose();
  }
};
```

To hand the results to the browser's registry rather than returning plain data, dehydrate the registry and render a `HydrationBoundary`. See [Hydration](/hydration#hydrationboundary).
