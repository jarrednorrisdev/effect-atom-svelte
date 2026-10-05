---
title: SvelteKit
description: Set up a SvelteKit app for atoms, keep typed errors through handleError, and choose between prerendering and rendering per request.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import BoundaryErrors from "./boundary-errors.svelte";
  import boundaryErrorsSource from "./boundary-errors.svelte?highlight";
  import BuiltAt from "./built-at.svelte";
  import builtAtSource from "./built-at.svelte?highlight";
  import todoCardSource from "./todo-card.svelte?highlight";
  import TodoCards from "./todo-cards.svelte";
  import todoCardsSource from "./todo-cards.svelte?highlight";
</script>

effect-atom-svelte works in any app on Svelte 5.57 or later, and doesn't depend on SvelteKit. This site and its tests run on SvelteKit 3. The one part made for SvelteKit, the error hooks in `effect-atom-svelte/sveltekit`, reads the `kind` field that SvelteKit 3 passes to `handleError`. SvelteKit 2 doesn't pass it, so there the hooks treat every error as one your code threw, SvelteKit's own included: they log it and keep its tag, and the client hook its message. For an app without SvelteKit, see [Plain Svelte](/installation#plain-svelte-no-sveltekit).

## Setting up an app

A SvelteKit app that renders atoms on the server needs these, each covered in more detail elsewhere:

1. **Svelte's options.** Turn on Svelte's experimental async in `vite.config.ts`, and SvelteKit's remote functions if you use them. See [Turn on async mode](/installation#turn-on-async-mode).
2. **A registry at the root.** Put one `RegistryProvider` in `src/routes/+layout.svelte`, and give it values from the request, such as cookies, through `initialValues`. See [Add a registry](/installation#add-a-registry) and [Starting atoms from request data](#starting-atoms-from-request-data).
3. **Error hooks.** To tell typed errors apart in `failed` snippets, export the hooks from `src/hooks.client.ts` and `src/hooks.server.ts`, and declare `tag` on `App.Error` in `src/app.d.ts`. See [Errors in boundaries](#errors-in-boundaries).
4. **API clients.** Give the server absolute URLs, and either send the visitor's credentials from the server or leave those queries to the browser. See [On the server](/rpc#on-the-server) and [Sending the visitor's credentials](#sending-the-visitors-credentials).
5. **Prerendering and caching.** Prerender the pages that don't depend on the request, and keep pages rendered for one visitor out of shared caches. See [Prerender or render per request](#prerender-or-render-per-request).

**Example** (SvelteKit's options in `vite.config.ts`)

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: { experimental: { async: true } },
      // Only if the app uses remote functions.
      experimental: { remoteFunctions: true },
    }),
  ],
});
```

## Errors in boundaries

When an atom fails inside a `<svelte:boundary>`, SvelteKit runs the error through its `handleError` hook before the boundary's `failed` snippet sees it. The default hook replaces any error your code threw with `{ message: "Internal Error" }`, so the snippet can't tell a `TodoNotFound` from a `Timeout`.

The `effect-atom-svelte/sveltekit` entry point has hooks that keep an Effect error's `_tag`:

**Example** (Keeping error tags)

```ts
// src/hooks.client.ts
export { handleClientError as handleError } from "effect-atom-svelte/sveltekit";
```

```ts
// src/hooks.server.ts
export { handleServerError as handleError } from "effect-atom-svelte/sveltekit";
```

```ts
// src/app.d.ts
declare global {
  namespace App {
    interface Error {
      tag?: string;
    }
  }
}

export {};
```

The `failed` snippet then receives the tag as `error.tag`:

```svelte
{#snippet failed(error)}
  {#if (error as App.Error).tag === "TodoNotFound"}
    <p>No such todo.</p>
  {:else}
    <p>{(error as App.Error).message}</p>
  {/if}
{/snippet}
```

The two hooks differ in one way:

- **The client hook** keeps the error's message too.
- **The server hook** keeps SvelteKit's `"Internal Error"` as the message, because a message from the server can reveal details of it. This applies to `failed` snippets rendered on the server.

Both log the error with `console.error`. They leave errors from `error(...)` and SvelteKit's own errors, such as 404s, as they are.

This site uses both hooks. In the example, the `failed` snippet tells the errors apart by their tag, and the panel below it shows the error it received.

<Example files={[{ html: boundaryErrorsSource, name: "boundary-errors.svelte" }]} hint="Click Todo 7, missing, then A slow todo: the failed snippet gets each error's tag and says what went wrong. A broken response is a defect with no tag, so only its message arrives."> <BoundaryErrors /> </Example>

<Aside type="tip" title="Your own handleError">

To report errors to a service or set other fields, write your own hook and call ours from it:

```ts
// src/hooks.client.ts
import type { HandleClientError } from "@sveltejs/kit/hooks";
import { handleClientError } from "effect-atom-svelte/sveltekit";

export const handleError: HandleClientError = (input) => {
  report(input.error);
  return handleClientError(input);
};
```

</Aside>

[Errors](/errors) covers the other ways to handle a failure, such as `includeFailure`, which resolves with the `Failure` instead of reaching the boundary.

### A failure on the server sets the status

When a `failed` snippet renders on the server, SvelteKit responds with the error's status, 500 for an atom's failure, even though the rest of the page renders. A prerendered page can't fail that way: the build stops at the 500. The example fails only in the browser for that reason: its boundary has a `pending` snippet, so the server renders that and never waits for the atom.

To render a failure on the server without the 500, read the atom with `includeFailure`, so the failure is a value the component shows rather than an error.

## Data in components

A component can `await` the atoms it needs, and the server render waits for them, so a page needs no `load` function to render its data. [Server rendering](/server-rendering) covers what the render waits for.

In the example, the page has no `load` function. Each card awaits its own todo, so the server rendered both into the page. After a change, a card loads its new todo in the browser, with the same code.

<Example files={[{ html: todoCardsSource, name: "todo-cards.svelte" }, { html: todoCardSource, name: "todo-card.svelte" }]} hint="Both cards came with the page, computed on the server. Click Show another todo: the second card loads its next todo in the browser by itself."> <TodoCards /> </Example>

To hand the results of `load` functions or remote functions to atoms, use [`HydrationBoundary`](/hydration#hydrationboundary).

## Starting atoms from request data

Some atoms start from something only the request has: a cookie, the signed-in user, a token. Read it in the root layout's `load`, and give it to the registry with `initialValues`, as `[atom, value]` pairs:

**Example** (A token from a cookie)

```ts
// src/lib/session.ts
import { Atom } from "effect/reactivity";

// The visitor's token. keepAlive, because the registry disposes of an atom
// nothing reads, initialValues included.
export const tokenAtom = Atom.make<string | undefined>(undefined).pipe(
  Atom.keepAlive
);
```

```ts
// src/routes/+layout.server.ts
export const load = ({ cookies }) => ({ token: cookies.get("token") });
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  import { tokenAtom } from "$lib/session.ts";

  const { children, data } = $props();
</script>

<RegistryProvider initialValues={[[tokenAtom, data.token]]}>
  {@render children()}
</RegistryProvider>
```

Without `Atom.keepAlive`, an atom given a value this way can be disposed of before a component reads it, and start again from its default. [Preferences in a cookie](/browser#preferences-in-a-cookie) uses the same pattern for a theme.

Data from a server `load` is written into the page, where any script can read it. That suits a token the page's scripts already hold, but not an `HttpOnly` session cookie. For data behind one of those, either fetch it in a server `load` with SvelteKit's `fetch`, which forwards the visitor's cookies to your own domain and its subdomains, and hand it to atoms with [`HydrationBoundary`](/hydration#hydrationboundary); or leave the query to the browser, inside a `<svelte:boundary>` with a `pending` snippet.

### Values that change during the visit

The provider reads `initialValues` once, when it creates the registry. That is all a server render needs, but in the browser the registry lasts the whole visit, so after a sign-in or a sign-out the atom would keep the old token, or the previous user's. Provide the registry from the script with `provideRegistry`, and write each new value with `$effect.pre`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { provideRegistry } from "effect-atom-svelte";

  import { tokenAtom } from "$lib/session.ts";

  const { children, data } = $props();

  // Read once, as the registry is created once.
  // svelte-ignore state_referenced_locally
  const registry = provideRegistry({
    initialValues: [[tokenAtom, data.token]],
  });

  // In the browser, write each new token. Effects don't run on the server.
  $effect.pre(() => registry.set(tokenAtom, data.token));
</script>

{@render children()}
```

The layout's `data` changes when its `load` runs again, so call `refreshAll()` from `$app/navigation` after signing in or out. Other atoms still hold what the previous user saw: to start every atom over, key the provider by the user instead, as in [Reset state when the user changes](/cookbook#reset-state-when-the-user-changes).

### Sending the visitor's credentials

On the server, an API client sends nothing from the visitor's request: no cookies and no `Authorization` header (see [On the server](/rpc#on-the-server)). To send the token, give the client a function instead of a layer. It receives the registry's context, so it can read `tokenAtom`, and the registry builds the client from its value. Each request on the server has its own registry, so each builds its own client:

**Example** (An RPC client that sends the visitor's token)

```ts
// src/lib/clients.ts
import { Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { TodosRpcs } from "./rpc.ts";
import { tokenAtom } from "./session.ts";

const origin = import.meta.env.SSR ? "http://localhost:3010" : "";

const withToken = (token: string | undefined) =>
  HttpClient.mapRequest((request) =>
    token ? HttpClientRequest.bearerToken(request, token) : request
  );

export class TodosRpc extends AtomRpc.Service<TodosRpc>()("app/TodosRpc", {
  group: TodosRpcs,
  protocol: (get) =>
    RpcClient.layerProtocolHttp({
      url: `${origin}/api/rpc`,
      transformClient: withToken(get(tokenAtom)),
    }).pipe(
      Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])
    ),
}) {}
```

A new token rebuilds the client, and the queries that use it run again. An `AtomHttpApi` client takes a function as its `httpClient` the same way:

```ts
httpClient: (get) =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, withToken(get(tokenAtom)))
  ).pipe(Layer.provide(FetchHttpClient.layer)),
```

A page rendered with a visitor's credentials is for that visitor only. See [Prerender or render per request](#prerender-or-render-per-request) for how to keep it out of shared caches.

### Starting values from a component

`useAtomInitialValues` gives atoms their starting values from a component, as `initialValues` on `RegistryProvider` does from the root. Use it when the value comes from a prop or a page's data rather than the root layout:

```svelte
<script lang="ts">
  import { untrack } from "svelte";
  import { useAtomInitialValues, useAtomValue } from "effect-atom-svelte";

  const { start } = $props();
  // Only the first value counts, so untrack says a later change to the prop isn't followed.
  useAtomInitialValues([[countAtom, untrack(() => start)]]);
  const count = useAtomValue(countAtom);
</script>
```

- **Once while the atom is held.** Each atom takes the first value a component gives it. A component that mounts again while something still holds the atom, or gets a new prop, doesn't set it again; once the atom has been disposed, the next component to mount sets it again. To follow a prop, write the atom with `useAtomSet`.
- **Held while the component lives.** The hook holds its atoms, so a value set in a layout is still there when a page reads it later. It doesn't compute them: the first component to read an atom does, and the atom keeps the value it was given.
- **Once per render on the server.** Each server render sets its values again, and renders them without running the atom, so an atom that reads `localStorage` or fetches can still be given a value there. Two renders at once on a shared registry share one value: give each request its own registry.
- **Where `initialValues` puts it.** An atom wrapped with `Atom.withRefresh`, `Atom.swr` or `Atom.debounce` passes the value to its source. The atom starts from the value and still reads its sources, so a derived atom computes again when one of them changes.

## Prerender or render per request

A page with `export const prerender = true` is rendered once, at build time. Every visitor gets the same HTML, with the results its serializable atoms had then, until something in the browser refreshes them.

This page is prerendered. The example's atom records when and where it ran, so the time it shows is when the site was built.

<Example files={[{ html: builtAtSource, name: "built-at.svelte" }]} hint="The time is when the site was built: the server ran the atom then, and every visitor gets that result. Click Compute again to run it in the browser, now."> <BuiltAt /> </Example>

Prerender only pages whose atoms can run at build time. They can't depend on the request, such as its cookies, and any API they call has to be reachable from the build. If a prerendered result shouldn't be as old as the build, run it again in the browser with [`revalidateOnHydrate`](/hydration#running-again-after-hydration).

A page rendered from a visitor's cookies or credentials holds that visitor's data, in its markup and in its [serialized results](/hydration#which-atoms-to-serialize). Never prerender it, and don't let a shared cache, such as a CDN, keep it and serve it to someone else. Send `Cache-Control: private` from its `load`, or `private, no-store` if the browser shouldn't keep it either:

**Example** (Keeping a visitor's page out of shared caches)

```ts
// src/routes/account/+page.server.ts
export const load = ({ setHeaders }) => {
  setHeaders({ "cache-control": "private" });
};
```

<Aside type="caution" title="Vary: Cookie is not enough">

`Vary: Cookie` asks a shared cache to keep one copy per `Cookie` header. Some CDNs ignore `Vary` apart from `Accept-Encoding`, so they would serve one visitor's page to the next. Those that honor it key on the whole header, so any other cookie, such as an analytics ID, makes a copy per visitor. Consider it only for a page that varies by a preference cookie with a few values, such as a theme, and check how your CDN treats it. For a page with a visitor's own data, send `Cache-Control: private`.

</Aside>

<Aside type="note" title="This site">

This site prerenders every page that doesn't depend on the request, so in its examples, "Computed on the server" means computed when the site was built. That includes [RPC](/rpc) and [HTTP API](/http), whose lists come from a copy of the demo API that runs during the build. [Browser atoms](/browser) reads cookies, so it is rendered for each request.

</Aside>
