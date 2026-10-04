---
title: Cookbook
description: Recipes for common tasks, from route params and infinite scroll to sockets and auth headers.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Auth from "./auth.svelte";
  import authSource from "./auth.svelte?highlight";
  import DraftHistory from "./draft-history.svelte";
  import draftHistorySource from "./draft-history.svelte?highlight";
  import historySource from "./history.ts?highlight";
  import LoadCount from "./load-count.svelte";
  import loadCountSource from "./load-count.svelte?highlight";
  import loadSource from "./+page.server.ts?highlight";
  import messagesSource from "./messages.svelte?highlight";
  import RouteParam from "./route-param.svelte";
  import Socket from "./socket.svelte";
  import socketSource from "./socket.svelte?highlight";
  import TodoForm from "./todo-form.svelte";
  import todoFormSource from "./todo-form.svelte?highlight";
  import todoFormClassSource from "./todo-form.svelte.ts?highlight";
  import todoPageSource from "./todo-page.svelte?highlight";
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

A page such as `/todos/[id]` shows one item, chosen by the URL. SvelteKit gives every page its route's params as the `params` prop. Read them inside a getter, so the hook follows them. Here the addresses stand in for the router:

<Example files={[{ html: todoPageSource, name: "todo-page.svelte" }]} hint="Pick an address: params.id changes, the getter returns the query for that todo, and the boundary awaits it. /todos/3 doesn't exist until you add a todo below."> <RouteParam /> </Example>

When you navigate from `/todos/1` to `/todos/2`, SvelteKit keeps the page component and changes its `params`. The getter then returns the query for the new id, and the boundary awaits it while the old todo stays on screen. A query called with the same arguments returns the same atom, so going back to `/todos/1` reuses that atom if it is still in the registry.

`params` is the same object as `page.params` from `$app/state`, which any component can read. For atoms of your own, put the param into an [`Atom.family`](/families) the same way: `useAtomSuspense(() => todoAtom(Number(params.id)))`. The [RPC page](/rpc#following-arguments) has a version driven by a `<select>`.

## Dependent queries

Sometimes one request needs the result of another, such as fetching a todo's details once the list tells you its id. Write an atom that reads the first atom with `get.result`, which waits for its value, and then makes the second request:

<Example files={[{ html: firstOpenSource, name: "first-open.svelte" }, { html: todosSource, name: "todos.ts" }]} hint="Click Done: the list is fetched again, then firstOpenAtom fetches the next open todo."> <FirstOpen /> </Example>

`get.result` fails the atom if the list fails, so the error reaches the component without any extra code. Because the atom read `todosAtom`, it runs again when the list changes. Click **Done**: the mutation invalidates `"todos"`, the list is fetched again, and the atom moves on to the next open todo.

If the second request only needs a value the component already has, a getter is enough: `useAtomValue(() => TodosRpc.query("getTodo", { id: selected }))`.

## Infinite scroll

A [pull atom](/streams#pull-atoms) loads one page each time you write to it. Write to it when an element at the end of the list scrolls into view:

<Example files={[{ html: feedSource, name: "feed.svelte" }]} hint="Scroll to the end of the list: each time the last row comes into view, the next ten entries arrive."> <Feed /> </Example>

The `IntersectionObserver` lives in an [attachment](https://svelte.dev/docs/svelte/@attach), which disconnects it when the element goes away. The `{#key}` block makes a new element after each page. If the end of the list is still in view, the new observer pulls again straight away.

With an API that takes a cursor, build the stream with `Stream.paginate` around the request, as the example does, and return the next cursor with each page.

## A form with typed errors and an optimistic update

This form adds a todo. It shows the todo straight away, shows the server's typed error if the title is too long, and removes the todo again when the save fails:

<Example files={[{ html: newTodoSource, name: "new-todo.svelte" }, { html: todosSource, name: "todos.ts" }]} hint="Add a todo: it shows up at once, marked as saving. Then try a title longer than 60 characters."> <NewTodo /> </Example>

Three pieces work together:

- **`Atom.optimistic` and `Atom.optimisticFn`** show the provisional list while the mutation runs. When it succeeds, the optimistic atom reads `todosAtom` again, so the mutation doesn't need `reactivityKeys`. See [Optimistic updates](/mutations#optimistic-updates).
- **`mode: "promiseExit"`** gives the submit handler the mutation's `Exit`, which never rejects.
- **`Cause.findErrorOption`** takes the first typed error out of the cause. Its type is the procedure's errors plus `RpcClientError`, so checking `_tag` narrows it to `TitleTooLong` and its `maxLength`.

To check a form before sending anything, decode its fields with a `Schema` in the submit handler, and show the issues the same way.

## Polling

To run an atom again on a timer, refresh it whenever a signal atom changes. `Atom.makeRefreshOnSignal` does that, and the signal can be any atom:

<Example files={[{ html: pollingSource, name: "polling.svelte" }]} hint="Watch the checks: the list is fetched again every three seconds. Add a todo in the form above, and the count catches up on the next one."> <Polling /> </Example>

The timer runs only while something reads the polled atom. When the last reader goes, the registry disposes of the signal and its finalizer clears the interval. Add a todo in the form above, and the count catches up on the next tick. `Atom.refreshOnWindowFocus` works the same way, with the tab becoming visible as its signal (see [Browser atoms](/browser#refreshing-when-the-tab-comes-back)).

## A WebSocket or server-sent events

A socket pushes messages whenever it likes. `Stream.callback` turns that into a stream: it hands you a queue, and you offer each message to it. An atom made from the stream holds the latest value. This one listens to server-sent events from the demo server with an `EventSource`:

<Example files={[{ html: messagesSource, name: "messages.svelte" }, { html: socketSource, name: "socket.svelte" }]} hint="Click Connect: a message arrives every 600 milliseconds. Disconnect, then connect again: a new connection counts from 1."> <Socket /> </Example>

The connection opens when something first reads `messagesAtom`. When the last reader goes, the registry stops the stream, which closes the scope, and the release closes the `EventSource`. `Stream.scan` keeps every message so far rather than only the latest. `Atom.withServerValueInitial` keeps the connection closed on the server, where it has nothing to show.

A WebSocket works the same way. Its stream can also end, by ending the queue when the socket closes:

**Example** (Collecting a WebSocket's messages)

```ts
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
```

<Aside type="tip" title="Streaming RPC">

If the server speaks Effect RPC, a procedure declared with `stream: true` gives you a stream atom without writing the socket code. See [Streaming procedures](/rpc#streaming-procedures).

</Aside>

## Auth headers

To add a header to every request, give the client a `transformClient` function. It takes the `HttpClient` and returns one that changes each request before it is sent. The demo server's `GET /api/me` answers `401 Unauthorized` unless the request carries `Authorization: Bearer demo-token`:

<Example files={[{ html: authSource, name: "auth.svelte" }]} hint="Send GET /api/me: without the header, the server answers 401. Turn on Signed in and send it again: the same client now adds the header."> <Auth /> </Example>

`mapRequest` runs for each request, so the token is read every time and a new one is picked up without rebuilding the client. The example keeps the token in module state, which is safe only because nothing sets it on the server (see the caution below). `RpcClient.layerProtocolHttp` takes a `transformClient` option too, for an `AtomRpc` client.

To add a header to one request only, pass `headers`. RPC queries and mutations take it, and so does an HTTP API request.

<Aside type="caution" title="The client is shared on the server">

A client defined at module level serves every request the server renders. Don't keep a visitor's token in module state there, or another visitor's render could send it. A session cookie on the same origin needs no code in the browser, because `fetch` sends it.

</Aside>

## Debounced search

A search box shouldn't send a request for every key press. `Atom.debounce` follows another atom once it has stopped changing for a while, and an async atom that reads it runs once per pause. Here the query also lives in the URL, through `Atom.searchParam`:

<Example files={[{ html: searchSource, name: "search.svelte" }]} hint="Type a few letters quickly: queryAtom changes on every key, debouncedAtom only once you pause, and only then does a search run."> <Search /> </Example>

When the debounced query changes while a search is still running, the atom runs again and interrupts the old search, so an old result never lands over a new one. [Browser atoms](/browser#the-urls-query-string) covers `Atom.searchParam`, including what the server sees.

## Atoms outside components

Atoms are plain values, so you can define them in any module. Their state lives in a registry, and there are three ways to get at one outside a component's markup.

### In a `.svelte.ts` class

The hooks need a component's context, but not its markup. A class that calls them in its constructor works, as long as a component creates it while it initializes:

<Example files={[{ html: todoFormClassSource, name: "todo-form.svelte.ts" }, { html: todoFormSource, name: "todo-form.svelte" }]} hint="Save a todo: the class's hooks show the save and the new count, and the lists in the recipes above fetch it too."> <TodoForm /> </Example>

Create it at the top level of the script, not in an event handler or after an `await` inside a function, for the same reason as any hook.

### The registry itself

`getRegistry()` returns the registry the hooks use. Call it while the component initializes, and keep the result for later, for example to read or write atoms from code that isn't reactive:

<Example files={[{ html: historySource, name: "history.ts" }, { html: draftHistorySource, name: "draft-history.svelte" }]} hint="Type a draft and save it: save, a plain function, writes both atoms through the registry, and the hooks show the change."> <DraftHistory /> </Example>

It has `get`, `set`, `update`, `refresh`, `subscribe` and `mount`, among others. A value written to an atom that nothing mounts is disposed shortly afterwards. See [Lifetimes](/lifetimes).

### In a load function

A `load` function runs outside any component, so it makes a registry of its own, and disposes of it when it is done. `AtomRegistry.getResult` waits for an async atom's result as an `Effect`. This page's own `+page.server.ts` counts the todos:

<Example files={[{ html: loadSource, name: "+page.server.ts" }, { html: loadCountSource, name: "load-count.svelte" }]} hint="Add a todo in one of the forms above: todosAtom's count follows, while load's stays at what it found when the page was rendered."> <LoadCount /> </Example>

What `load` returns is plain data, rendered once: it changes only when the page loads again. To hand the results to the browser's registry instead, dehydrate the registry and render a `HydrationBoundary`. See [Hydration](/hydration#hydrationboundary).
