---
title: RPC
description: Turn an Effect RPC group into atoms for queries, mutations and streams.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import CreateAndRead from "./create-and-read.svelte";
  import createAndReadSource from "./create-and-read.svelte?highlight";
  import rpcSource from "../../../../../packages/demo-domain/src/rpc.ts?highlight";
  import todoSource from "../../../../../packages/demo-domain/src/todo.ts?highlight";
  import Lookup from "./lookup.svelte";
  import lookupSource from "./lookup.svelte?highlight";
  import Ticks from "./ticks.svelte";
  import ticksSource from "./ticks.svelte?highlight";
  import Todos from "./todos.svelte";
  import todosSource from "./todos.svelte?highlight";
</script>

If your server speaks [Effect RPC](https://github.com/Effect-TS/effect/tree/main/packages/effect/src/rpc), `AtomRpc` gives your components its procedures as atoms. A query is an async atom you read, a mutation is an atom you write, and both keep the RPC's typed payloads and errors.

The examples on this page call the [demo API](/#how-these-docs-work). The `rpc.ts` tab shows its `RpcGroup`, and `todo.ts` the schemas it uses.

<Example files={[{ html: todosSource, name: "todos.svelte" }, { html: rpcSource, name: "rpc.ts" }, { html: todoSource, name: "todo.ts" }]} hint="Add a todo and watch listTodos: the mutation invalidates the todos key, so the query fetches again and its requests count goes up. Then click Paste a long title and Add: the procedure fails with its typed TitleTooLong."> <Todos /> </Example>

## Defining the client

`AtomRpc.Service` takes your `RpcGroup` and a protocol layer that says how to reach the server. Define it once and import it wherever you need it:

**Example** (An RPC client over HTTP)

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { TodosRpcs } from "./rpc.ts";

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

<Example files={[{ html: lookupSource, name: "lookup.svelte" }]} hint="Pick another todo: the old one stays on screen, dimmed, until the new one arrives. Todo 99 comes back as the procedure's typed TodoNotFound."> <Lookup /> </Example>

## Mutations

`mutation` takes a procedure's tag and returns an [`Atom.fn`](/mutations). Write an object with the `payload` to call it:

```ts
// In a module
const createAtom = TodosRpc.mutation("createTodo");

// In a component's script
import { useAtomSet } from "effect-atom-svelte";

const create = useAtomSet(createAtom, { mode: "promiseExit" });
const exit = await create({
  payload: { title: "Write the docs" },
  reactivityKeys: ["todos"],
});
```

Besides `payload`, the object can carry `reactivityKeys` to invalidate once the call succeeds, and `headers`.

A procedure's errors arrive typed. In `promiseExit` mode, the `Exit`'s cause holds the RPC's own error, such as `TitleTooLong` in the example at the top of this page. [Errors](/errors) shows how to match on them.

## Streaming procedures

A procedure declared with `stream: true` becomes a **pull atom**. It reads the first chunk of the stream, then the next chunk each time you write to it, and its `value` holds every item so far and whether the stream is `done`:

<Example files={[{ html: ticksSource, name: "ticks.svelte" }]} hint="Click Start over, then Pull next, quickly and then slowly. Each pull brings every number that has arrived since the last one, so a slow pull brings several."> <Ticks /> </Example>

<Aside type="note" title="A pull can bring more than one item">

Over HTTP, the server doesn't wait for the client to ask: it sends items as they are ready, and they queue up in the browser. A pull takes everything that has arrived since the last pull, so wait a second before clicking **Pull next** and several numbers appear at once.

</Aside>

**Start over** refreshes the atom with `useAtomRefresh`, which calls the procedure again and starts a new stream. Until its first item arrives, the atom keeps the old items, `waiting`.

[Streams](/streams) covers pull atoms in general.

## Calling the client yourself

For anything a single query or mutation doesn't cover, write an effect that uses the client, and run it with the service's runtime. `yield* TodosRpc` gives the client, a function that takes a procedure's tag and its payload. The example creates a todo and then reads it back, in one call of one `Atom.fn`:

<Example files={[{ html: createAndReadSource, name: "create-and-read.svelte" }]} hint="Click Create and read, and watch the calls: getTodo waits for the id that createTodo returns. Then paste a long title: createTodo fails, and getTodo is never sent."> <CreateAndRead /> </Example>

The effect's error type is the union of both procedures' errors, plus `RpcClientError`, and the first failure ends it.
