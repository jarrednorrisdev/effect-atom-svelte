---
title: HTTP API
description: Turn an Effect HttpApi into atoms for its endpoints.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Lookup from "./lookup.svelte";
  import lookupSource from "./lookup.svelte?highlight";
  import Todos from "./todos.svelte";
  import todosSource from "./todos.svelte?highlight";
</script>

If your server is described by an Effect `HttpApi`, `AtomHttpApi` gives your components its endpoints as atoms. It works like [`AtomRpc`](/rpc): queries are async atoms you read, mutations are atoms you write, and the endpoint's schemas type the path params, query string, payload and errors.

The examples on this page call the same demo server as the RPC page, through its HTTP API.

<Example files={[{ html: todosSource, name: "todos.svelte" }]}> <Todos /> </Example>

## Defining the client

`AtomHttpApi.Service` takes your `HttpApi` and an HTTP client layer:

**Example** (An HTTP API client)

```ts
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi } from "effect/reactivity";

import { TodosApi } from "./api.ts";

export class TodosHttp extends AtomHttpApi.Service<TodosHttp>()(
  "app/TodosHttp",
  {
    api: TodosApi,
    httpClient: FetchHttpClient.layer,
  }
) {}
```

Requests go to the endpoint's path on the page's origin. Set `baseUrl` to send them somewhere else, and give the server an absolute URL, because a relative one can't be resolved when the page renders there. Use `transformClient` to add things like authentication to every request.

## Queries

`query` takes a group name, an endpoint name and the request. The request has the endpoint's `params`, `query`, `payload` and `headers`, typed by its schemas:

**Example** (Endpoints with a query string and a path param)

```ts
// GET /api/todos?done=true
const doneAtom = TodosHttp.query("todos", "list", { query: { done: "true" } });

// GET /api/todos/1
const firstAtom = TodosHttp.query("todos", "get", { params: { id: 1 } });
```

The request also takes the same options as an RPC query: `reactivityKeys`, `serializationKey` and `timeToLive`. See [RPC](/rpc#queries).

As with RPC, the same request gives the same atom, so a getter can build the query from component state. The example above switches between three lists that way.

### Typed errors

An endpoint's declared errors come back as typed failures. A `TodoNotFound` declared with status 404 fails the query with a `TodoNotFound`, not a generic HTTP error. Pass `includeFailure: true` to `useAtomSuspense` to handle it in your markup:

<Example files={[{ html: lookupSource, name: "lookup.svelte" }]}> <Lookup /> </Example>

## Mutations

`mutation` takes a group name and an endpoint name, and returns an [`Atom.fn`](/mutations). Write the request to call it, with `reactivityKeys` to invalidate once it succeeds:

```ts
// POST /api/todos
const createAtom = TodosHttp.mutation("todos", "create");

const create = useAtomSet(createAtom, { mode: "promiseExit" });
await create({
  payload: { title: "Write the docs" },
  reactivityKeys: ["todos"],
});
```

<Aside type="tip" title="Reading the response itself">

Queries and mutations succeed with the decoded body. Set `responseMode` in a query's request, or in `mutation`'s third argument, to change that. `"decoded-and-response"` gives a `[body, response]` pair, so you can read the status or headers. `"response-only"` gives the `HttpClientResponse` without decoding it.

</Aside>
