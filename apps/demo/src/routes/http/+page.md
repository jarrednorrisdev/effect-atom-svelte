---
title: HTTP API
description: Turn an Effect HttpApi into atoms for its endpoints.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import httpSource from "../../../../../packages/demo-domain/src/http.ts?highlight";
  import todoSource from "../../../../../packages/demo-domain/src/todo.ts?highlight";
  import Lookup from "./lookup.svelte";
  import lookupSource from "./lookup.svelte?highlight";
  import Todos from "./todos.svelte";
  import Transform from "./transform.svelte";
  import transformSource from "./transform.svelte?highlight";
  import todosSource from "./todos.svelte?highlight";
</script>

If your server is described by an Effect `HttpApi`, `AtomHttpApi` gives your components its endpoints as atoms. It works like [`AtomRpc`](/rpc): queries are async atoms you read, mutations are atoms you write, and the endpoint's schemas type the path params, query string, payload and errors.

The examples on this page call the [demo API](/#how-these-docs-work). The `http.ts` tab shows its `HttpApi`, and `todo.ts` the schemas it uses. On this site, the page is prerendered, so the lists it opens with came from the copy of the demo API that ran during the build.

<Example files={[{ html: todosSource, name: "todos.svelte" }, { html: httpSource, name: "http.ts" }, { html: todoSource, name: "todo.ts" }]} hint="Click Open, then Done: each filter is its own query atom with its own request, and the requests count goes up. Go back to All: that atom already has its list."> <Todos /> </Example>

## Defining the client

`AtomHttpApi.Service` takes your `HttpApi` and an HTTP client layer:

**Example** (An HTTP API client)

```ts
import { FetchHttpClient } from "effect/http";
import { AtomHttpApi } from "effect/reactivity";

import { DemoApi } from "./http.ts";

export class TodosHttp extends AtomHttpApi.Service<TodosHttp>()(
  "app/TodosHttp",
  {
    api: DemoApi,
    httpClient: FetchHttpClient.layer,
  }
) {}
```

Requests go to the endpoint's path on the page's origin. Set `baseUrl` to send them somewhere else.

The class is also an Effect service whose value is the `HttpApi` client, with a method for each endpoint, so `runtime.fn` can call it directly: see [Customizing requests](#customizing-requests).

## Queries

`query` takes a group name, an endpoint name and the request. The request has the endpoint's `params`, `query`, `payload` and `headers`, typed by its schemas:

**Example** (Endpoints with a query string and a path param)

```ts
// GET /api/todos?done=true
const doneAtom = TodosHttp.query("todos", "list", { query: { done: "true" } });

// GET /api/todos/1
const firstAtom = TodosHttp.query("todos", "get", { params: { id: 1 } });
```

The request also takes options:

| Option | Does |
| --- | --- |
| `reactivityKeys` | Fetch again when a mutation invalidates one of these keys. See [Refreshing what changed](/mutations#refreshing-what-changed). |
| `serializationKey` | When the query is read with `useAtomResult` or `useAtomSuspense`, send the server's result to the browser, which uses it when it hydrates instead of fetching again. See [Hydration](/hydration). |
| `timeToLive` | Keep the result for this long after the last reader goes away. An infinite duration keeps it for good. |
| `headers` | The endpoint's own headers, typed by its headers schema. Only endpoints that declare one take it. |
| `responseMode` | What the query succeeds with: the decoded body by default. See the tip under [Mutations](#mutations). |

The same request gives the same atom, compared by value, so a getter can build the query from component state. The example at the top switches between three lists that way.

### Typed errors

An endpoint's declared errors come back as typed failures. A `TodoNotFound` declared with status 404 fails the query with a `TodoNotFound`, not a generic HTTP error. In a `query` or `mutation`, a request that fails (`HttpClientError`) or a response that doesn't decode (`SchemaError`) is a defect rather than a typed error. When you call the client yourself, as in [Customizing requests](#customizing-requests), those two stay in the error type.

Pass `includeFailure: true` to `useAtomSuspense` to handle the typed error in your markup. [Errors](/errors) covers the other ways.

<Example files={[{ html: lookupSource, name: "lookup.svelte" }]} hint="Click 99, or type an id: the 404 comes back as a typed TodoNotFound, which the markup matches on."> <Lookup /> </Example>

## Mutations

`mutation` takes a group name and an endpoint name, and returns an [`Atom.fn`](/mutations). Write the request to call it, with `reactivityKeys` to invalidate once it succeeds:

```ts
// In a module: POST /api/todos
const createAtom = TodosHttp.mutation("todos", "create");

// In a component's script
import { useAtomSet } from "effect-atom-svelte";

const create = useAtomSet(createAtom, { mode: "promiseExit" });
await create({
  payload: { title: "Write the docs" },
  reactivityKeys: ["todos"],
});
```

<Aside type="tip" title="Reading the response itself">

Queries and mutations succeed with the decoded body. Set `responseMode` in a query's request, or in `mutation`'s third argument, to change that. `"decoded-and-response"` gives a `[body, response]` pair, so you can read the status or headers. `"response-only"` gives the `HttpClientResponse` without decoding it.

A response can't be sent to the browser, so a query's `serializationKey` only applies with the default, `"decoded-only"`, and is ignored with the other two.

</Aside>

## Customizing requests

Use `transformClient` to change every request, for example to add a header. It takes the `HttpClient` and returns another, so any of `HttpClient`'s combinators work there. The example adds an `x-reader` header to every request. Its client also logs each request it sends, for the panel under the example. [Auth headers](/cookbook#auth-headers) in the cookbook uses `transformClient` to send a token:

<Example files={[{ html: transformSource, name: "transform.svelte" }]} hint="Get todo 1, then todo 99: each request carries the x-reader header, and the log shows the 200 and the 404."> <Transform /> </Example>

The example calls the client directly, with `runtime.fn`. Every query and mutation goes through the same transformed client.

### On the server

Requests made on the server don't carry the visitor's cookies, so a query that needs a session fails there. With a `serializationKey`, what happens next depends on the error. A status the endpoint doesn't declare is an `HttpClientError`, which the query turns into a defect. Defects aren't sent with the page, so the browser runs the query again, with its cookies. An error the API declares, such as an `Unauthorized` from an auth middleware, is a typed error. It is sent, and the browser starts from it. `transformClient` is the same function for every request, so it can't send each visitor's own credentials. Like RPC's `protocol`, `httpClient` can instead be a function that reads an atom set for each request: [Sending the visitor's credentials](/sveltekit#sending-the-visitors-credentials) has the recipe.
