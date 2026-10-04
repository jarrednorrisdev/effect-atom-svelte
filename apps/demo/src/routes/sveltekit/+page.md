---
title: SvelteKit
description: Keep typed errors through SvelteKit's error handling, and load data without load functions.
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

effect-atom-svelte works in any app on Svelte 5.57 or later, and SvelteKit 3 needs very little extra. Set Svelte's options in `vite.config.ts` and put a `RegistryProvider` in your root layout, as in [Installation](/installation). This page covers the parts where SvelteKit and Effect meet: errors, data loading and prerendering.

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

<Aside type="caution" title="A failure on the server sets the status">

When a `failed` snippet renders on the server, SvelteKit responds with the error's status, 500 for an atom's failure, even though the rest of the page renders. A prerendered page can't fail that way: the build stops at the 500. The example fails only in the browser for that reason: its boundary has a `pending` snippet, so the server renders that and never waits for the atom.

</Aside>

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

In the example, the page has no `load` function. Each card awaits its own todo, so the server rendered both into the page. After a change, a card loads its new todo in the browser, with the same code.

<Example files={[{ html: todoCardsSource, name: "todo-cards.svelte" }, { html: todoCardSource, name: "todo-card.svelte" }]} hint="Both cards came with the page, computed on the server. Click Show another todo: the second card loads its next todo in the browser by itself."> <TodoCards /> </Example>

`load` functions and remote functions still work alongside this. To hand their results to atoms, dehydrate a registry on the server and pass it to [`HydrationBoundary`](/hydration#hydrationboundary).

## Prerendering

A page with `export const prerender = true` is rendered once, at build time. Its atoms are computed during the build, and the results of serializable atoms awaited with `useAtomResult` or `useAtomSuspense` are hydrated in the browser as usual, so a prerendered page shows the data from when the site was built until something refreshes it.

This page is prerendered. The example's atom records when and where it ran, so the time it shows is when the site was built.

<Example files={[{ html: builtAtSource, name: "built-at.svelte" }]} hint="The time is when the site was built: the server ran the atom then, and every visitor gets that result. Click Compute again to run it in the browser, now."> <BuiltAt /> </Example>

Prerender only pages whose atoms can run at build time. They can't depend on the request, such as its cookies, and any API they call has to be reachable from the build.

<Aside type="note" title="This site">

This site's pages are prerendered where they can be. In the examples on this page, [Server rendering](/server-rendering) and [Hydration](/hydration), "Computed on the server" means computed when the site was built.

</Aside>
