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
  import Socket from "./socket.svelte";
  import socketSource from "./socket.svelte?highlight";
  import TodoForm from "./todo-form.svelte";
  import todoFormSource from "./todo-form.svelte?highlight";
  import todoFormClassSource from "./todo-form.svelte.ts?highlight";
  import Feed from "./feed.svelte";
  import feedSource from "./feed.svelte?highlight";
  import FirstOpen from "./first-open.svelte";
  import firstOpenSource from "./first-open.svelte?highlight";
  import Polling from "./polling.svelte";
  import pollingSource from "./polling.svelte?highlight";
  import Search from "./search.svelte";
  import searchSource from "./search.svelte?highlight";
  import todosSource from "./todos.ts?highlight";
</script>

Each recipe on this page solves one common task with the pieces from the rest of the guide. The live ones call the same demo server as the [RPC](/rpc) page, so a todo you add in one shows up in the others.

## Queries

### A route param that picks the query

A page such as `/todos/[id]` shows one item, chosen by the URL. SvelteKit gives every page its route's params as the `params` prop. Read them inside a getter, so the hook follows them:

**Example** (One todo per address)

```svelte
<!-- src/routes/todos/[id]/+page.svelte -->
<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosRpc } from "$lib/clients.ts";

  const { params } = $props();
  // Read inside the getter, so the hook follows params.id.
  const todo = useAtomSuspense(() =>
    TodosRpc.query("getTodo", { id: Number(params.id) })
  );
</script>

<svelte:boundary>
  <h1>{(await todo.current).title}</h1>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
```

When you navigate from `/todos/1` to `/todos/2`, SvelteKit keeps the page component and changes its `params`. The getter then returns the query for the new id, and the boundary awaits it while the old todo stays on screen. A query called with the same arguments returns the same atom, so going back to `/todos/1` reuses that atom if it is still in the registry. [Following arguments](/rpc#following-arguments) on the RPC page has a live version, with buttons in place of the router.

`params` has the same values as `page.params` from `$app/state`, which any component can read. For atoms of your own, put the param into an [`Atom.family`](/families) the same way: `useAtomSuspense(() => todoAtom(Number(params.id)))`.

### Dependent queries

Sometimes one request needs the result of another, such as fetching a todo's details once the list tells you its id. Write an atom that reads the first atom with `get.result`, which waits for its value, and then makes the second request:

<Example files={[{ html: firstOpenSource, name: "first-open.svelte" }, { html: todosSource, name: "todos.ts" }]} hint="Click Done: the list is fetched again, then firstOpenAtom fetches the next open todo."> <FirstOpen /> </Example>

`get.result` fails the atom if the list fails, so the error reaches the component without any extra code. With `suspendOnWaiting`, it waits for a list that is being fetched again, rather than using the old one. Because the atom read `todosAtom`, it runs again when the list changes. Click **Done**: the mutation invalidates `"todos"`, the list is fetched again, and the atom moves on to the next open todo.

If the second request only needs a value the component already has, a getter is enough: `useAtomValue(() => TodosRpc.query("getTodo", { id: selected }))`.

### Polling

To run an atom again on a timer, refresh it whenever a signal atom changes. `Atom.makeRefreshOnSignal` does that, and the signal can be any atom:

<Example files={[{ html: pollingSource, name: "polling.svelte" }]} hint="Watch the checks: the list is fetched again every three seconds."> <Polling /> </Example>

Polling picks up changes made elsewhere: add a todo with the form in [Share form logic in a class](#share-form-logic-in-a-class), further down, and the count catches up on the next check.

The timer runs only while something reads the polled atom. When the last reader goes, the registry disposes of the signal and its finalizer clears the interval. `Atom.refreshOnWindowFocus` works the same way, with the tab becoming visible as its signal (see [Browser atoms](/browser#refreshing-when-the-tab-comes-back)).

### Debounced search

A search box shouldn't send a request for every key press. `Atom.debounce` follows another atom once it has stopped changing for a while, and an async atom that reads it runs once per pause:

<Example files={[{ html: searchSource, name: "search.svelte" }]} hint="Type a few letters quickly: queryAtom changes on every key, debouncedAtom only once you pause, and only then does a search run."> <Search /> </Example>

When the debounced query changes while a search is still running, the atom runs again and interrupts the old search, so an old result never lands over a new one. To keep the query in the URL, make `queryAtom` with `Atom.searchParam`. In a SvelteKit app, do that only when nothing else reads the parameter, as SvelteKit's router doesn't see its changes: see [The URL's query string](/browser#the-urls-query-string).

### Infinite scroll

A [pull atom](/streams#pull-atoms) loads one page each time you write to it. Write to it when an element at the end of the list scrolls into view:

<Example files={[{ html: feedSource, name: "feed.svelte" }]} hint="Scroll to the end of the list: each time the last row comes into view, the next ten entries arrive."> <Feed /> </Example>

The `IntersectionObserver` lives in an [attachment](https://svelte.dev/docs/svelte/@attach), which disconnects it when the element goes away. The `{#key}` block makes a new element after each page. If the end of the list is still in view, the new observer pulls again straight away.

With an API that takes a cursor, build the stream with `Stream.paginate` around the request, as the example does, and return the next cursor with each page.

## Connections

### A WebSocket or server-sent events

A socket pushes messages whenever it likes. `Stream.callback` turns that into a stream: it hands you a queue, and you offer each message to it. An atom made from the stream holds the latest value. This one listens to server-sent events from the demo server with an `EventSource`:

<Example files={[{ html: messagesSource, name: "messages.svelte" }, { html: socketSource, name: "socket.svelte" }]} hint="Click Connect: a message arrives every 600 milliseconds. Disconnect, then connect again: a new connection counts from 1."> <Socket /> </Example>

The connection opens when something first reads `messagesAtom`. When the last reader goes, the registry stops the stream, which closes the scope, and the release closes the `EventSource`. `Stream.scan` keeps a count and the last five messages rather than only the latest. Keep such a list capped: a connection left open would otherwise grow it forever. `Atom.withServerValueInitial` keeps the connection closed on the server, where it has nothing to show.

A WebSocket works the same way. Its stream can also end, by ending the queue when the socket closes, and fail, by failing the queue on an error:

**Example** (Collecting a WebSocket's messages)

```ts
import { Cause, Data, Effect, Queue, Stream } from "effect";

class SocketError extends Data.TaggedError("SocketError") {}

const messages = Stream.callback<string, SocketError>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const socket = new WebSocket("wss://example.com/feed");
      socket.addEventListener("message", (event) => {
        Queue.offerUnsafe(queue, String(event.data));
      });
      socket.addEventListener("error", () => {
        Queue.failCauseUnsafe(queue, Cause.fail(new SocketError()));
      });
      socket.addEventListener("close", () => Queue.endUnsafe(queue));
      return socket;
    }),
    (socket) => Effect.sync(() => socket.close())
  )
);
```

An atom made from this stream becomes a `Failure` with `SocketError` when the socket fails.

<Aside type="tip" title="Streaming RPC">

If the server speaks Effect RPC, a procedure declared with `stream: true` gives you a stream atom without writing the socket code. See [Streaming procedures](/rpc#streaming-procedures).

</Aside>

### Auth headers

Add the token to each request in the client's `transformClient`, as on [HTTP API](/http#customizing-requests). `mapRequest` runs for each request, so a new token is picked up without rebuilding the client. The demo server's `GET /api/me` answers `401 Unauthorized` unless the request carries `Authorization: Bearer demo-token`:

<Example files={[{ html: authSource, name: "auth.svelte" }]} hint="Send GET /api/me: without the header, the server answers 401. Turn on Signed in and send it again: the same client now adds the header."> <Auth /> </Example>

The example keeps the token in module state, which is safe only in the browser: a module-level client serves every request on the server. To send each visitor's token from the server, see [On the server](/rpc#on-the-server).

## Structuring an app

### Share form logic in a class

The hooks need a component's context, but not its markup. A class in a `.svelte.ts` file that calls them in its constructor works, as long as a component creates it while it initializes:

<Example files={[{ html: todoFormClassSource, name: "todo-form.svelte.ts" }, { html: todoFormSource, name: "todo-form.svelte" }]} hint="Save a todo: the class's hooks show the save and the new count, and the lists in the recipes above fetch it too."> <TodoForm /> </Example>

Create it at the top level of the script, not in an event handler or after an `await` inside a function. See [can only be used during component initialisation](/troubleshooting#can-only-be-used-during-component-initialisation).

### Write atoms from a plain function

`getRegistry()` returns the registry the hooks use. Call it while the component initializes, and keep the result for later, for example to read or write atoms from code that isn't reactive:

<Example files={[{ html: historySource, name: "history.ts" }, { html: draftHistorySource, name: "draft-history.svelte" }]} hint="Type a draft and save it: save, a plain function, writes both atoms through the registry, and the hooks show the change."> <DraftHistory /> </Example>

It has `get`, `set`, `update`, `refresh`, `subscribe` and `mount`, among others. A value written to an atom that nothing holds is disposed once the current task ends, so `mount` the atom, or keep it alive, if code reads it later. See [Lifetimes](/lifetimes#held-atoms).

### Read an atom in a load function

A `load` function runs outside any component, so it makes a registry of its own, and disposes of it when it is done. `AtomRegistry.getResult` waits for an async atom's result as an `Effect`. This page's own `+page.server.ts` counts the todos:

<Example files={[{ html: loadSource, name: "+page.server.ts" }, { html: loadCountSource, name: "load-count.svelte" }]} hint="Add a todo in one of the forms above: todosAtom's count follows, while load's stays at what it found when the page was rendered."> <LoadCount /> </Example>

What `load` returns is plain data, rendered once: it changes only when the page loads again. To prefetch atoms into the browser's registry instead, see [HydrationBoundary](/hydration#hydrationboundary).

### Reset state when the user changes

Atoms that are kept alive, have an idle TTL or are held by the layout survive a sign-out, so the next user could see the last one's data. Give each user a registry of their own: key the `RegistryProvider` in the root layout by the user's id.

**Example** (A new registry for each user)

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  let { children, data } = $props();
</script>

{#key data.user?.id}
  <RegistryProvider>{@render children()}</RegistryProvider>
{/key}
```

When the id changes, `{#key}` destroys the old provider, which disposes of its registry and every atom in it, and creates a new one. Everything below it mounts again, so component state starts over too. To reset only some atoms, add the user's id to a [family](/families)'s key instead.

## Elsewhere in these docs

- **Retry with backoff:** pipe the effect through `Effect.retry` with a `Schedule`, as in [Retrying](/errors#retrying). For an `AtomRpc` or `AtomHttpApi` query, call the client in an effect of your own, as in [Calling the client yourself](/rpc#calling-the-client-yourself), and retry that.
- **Cancel a mutation in flight:** write `Atom.Interrupt` to it, for example from a Cancel button. See [Canceling and resetting](/mutations#canceling-and-resetting).
- **An optimistic form with typed errors:** see [Optimistic updates](/mutations#optimistic-updates) and [Mutations: `promise` and `promiseExit`](/errors#mutations-promise-and-promiseexit).
- **Keep a value across reloads:** store it with `Atom.kvs`. See [Persisting to localStorage](/browser#persisting-to-localstorage).
