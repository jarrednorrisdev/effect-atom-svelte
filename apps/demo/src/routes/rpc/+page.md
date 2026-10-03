---
title: RPC
description: Turn an Effect RPC group into atoms for queries, mutations and streams.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Lookup from "./lookup.svelte";
  import lookupSource from "./lookup.svelte?highlight";
  import Ticks from "./ticks.svelte";
  import ticksSource from "./ticks.svelte?highlight";
  import Todos from "./todos.svelte";
  import todosSource from "./todos.svelte?highlight";
</script>

If your server speaks [Effect RPC](https://effect.website), `AtomRpc` gives your components its procedures as atoms. A query is an async atom you read, a mutation is an atom you write, and both keep the RPC's typed payloads and errors.

The examples on this page call a small demo server that keeps a todo list.

<Example files={[{ html: todosSource, name: "todos.svelte" }]}> <Todos /> </Example>

## Defining the client

`AtomRpc.Service` takes your `RpcGroup` and a protocol layer that says how to reach the server. Define it once and import it wherever you need it:

**Example** (An RPC client over HTTP)

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { TodosRpcs } from "./rpcs.ts";

export class TodosRpc extends AtomRpc.Service<TodosRpc>()("app/TodosRpc", {
  group: TodosRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])
  ),
}) {}
```

The class is also an Effect service, with a `runtime` that builds the protocol layer the first time an atom needs it.

<Aside type="caution" title="Use an absolute URL on the server">

When a page renders on the server, its queries run there too, and a relative URL such as `/api/rpc` has no origin to resolve against. Give the server the full URL, for example by checking `import.meta.env.SSR` when you build the protocol layer.

</Aside>

## Queries

`query` takes a procedure's tag and its payload, and returns an async atom of the result:

```ts
const todosAtom = TodosRpc.query("listTodos", undefined);
```

Read it like any other [async atom](/async-atoms): with `useAtomValue`, `useAtomSuspense` in markup, or `await useAtomResult` in the script. The example above awaits it in the script, so server rendering waits for the list.

A third argument takes options:

| Option | Does |
| --- | --- |
| `reactivityKeys` | Fetch again when a mutation invalidates one of these keys. |
| `serializationKey` | When the query is read with `useAtomResult` or `useAtomSuspense`, send the server's result to the browser, which uses it when it hydrates instead of fetching again. See [Hydration](/hydration). |
| `timeToLive` | Keep the result for this long after the last reader goes away. An infinite duration keeps it for good. |
| `headers` | Extra headers for the request. |

### Following arguments

`query` returns the same atom whenever you pass the same arguments, compared by value. So you can call it inside a getter, and the hook moves to a new query whenever the arguments change:

<Example files={[{ html: lookupSource, name: "lookup.svelte" }]}> <Lookup /> </Example>

## Mutations

`mutation` takes a procedure's tag and returns an [`Atom.fn`](/mutations). Write an object with the `payload` to call it:

```ts
const createAtom = TodosRpc.mutation("createTodo");

const create = useAtomSet(createAtom, { mode: "promiseExit" });
const exit = await create({
  payload: { title: "Write the docs" },
  reactivityKeys: ["todos"],
});
```

Besides `payload`, the object can carry `reactivityKeys` to invalidate once the call succeeds, and `headers`.

A procedure's errors arrive typed. In `promiseExit` mode, the `Exit`'s cause holds the RPC's own error, such as `TitleTooLong` in the example at the top of this page.

## Streaming procedures

A procedure declared with `stream: true` becomes a **pull atom**. It reads the first chunk of the stream, then the next chunk each time you write to it, and its `value` holds every item so far and whether the stream is `done`:

<Example files={[{ html: ticksSource, name: "ticks.svelte" }]}> <Ticks /> </Example>

<Aside type="note" title="A pull can bring more than one item">

Over HTTP, the server doesn't wait for the client to ask: it sends items as they are ready, and they queue up in the browser. A pull takes everything that has arrived since the last pull, so wait a second before clicking **Pull next** and several numbers appear at once.

</Aside>

[Streams](/streams) covers pull atoms in general.

## Calling the client yourself

For anything a single query or mutation doesn't cover, write an effect that uses the client, and run it with the service's runtime:

**Example** (Creating a todo and then reading it back)

```ts
import { Effect } from "effect";

const createAndReadAtom = TodosRpc.runtime.fn((title: string) =>
  Effect.gen(function* () {
    const client = yield* TodosRpc;
    const created = yield* client("createTodo", { title });
    return yield* client("getTodo", { id: created.id });
  })
);
```
