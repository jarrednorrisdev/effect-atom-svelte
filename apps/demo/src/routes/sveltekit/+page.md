---
title: SvelteKit
description: Keep typed errors through SvelteKit's error handling, and load data without load functions.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

effect-atom-svelte works in any Svelte 5 app, and SvelteKit 3 needs very little extra. Set Svelte's options in `vite.config.ts` and put a `RegistryProvider` in your root layout, as in [Installation](/installation). This page covers the parts where SvelteKit and Effect meet: errors, data loading and prerendering.

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

Both log the error like SvelteKit's default hooks. They leave errors from `error(...)` and SvelteKit's own errors, such as 404s, as they are.

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

Alternatively, handle the error before it reaches the boundary: `useAtomSuspense(atom, { includeFailure: true })` resolves with the `Failure` itself, typed error and all. See [Suspense](/suspense#handling-failure).

## Data without load functions

A component can `await` the atoms it needs, and the server render waits for them, as described in [Server rendering](/server-rendering). Each component asks for its own data, and nothing has to be passed down from a `load` function.

`load` functions and remote functions still work alongside this. To hand their results to atoms, dehydrate a registry on the server and pass it to [`HydrationBoundary`](/hydration#hydrationboundary).

## Prerendering

A page with `export const prerender = true` is rendered once, at build time. Its atoms are computed during the build, and their results are hydrated in the browser as usual, so a prerendered page shows the data from when the site was built until something refreshes it.

Prerender only pages whose atoms can run at build time. They can't depend on the request, such as its cookies, and any API they call has to be reachable from the build.

<Aside type="note">

This site's pages are prerendered where they can be. On the [Hydration](/hydration) page, "Computed on the server" means computed when the site was built.

</Aside>
