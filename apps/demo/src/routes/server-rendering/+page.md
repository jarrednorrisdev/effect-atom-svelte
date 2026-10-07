---
title: Server rendering
description: What happens to atoms when a page renders on the server, and what the render waits for.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import laterSource from "./later.svelte?highlight";
  import requestSource from "./request.svelte?highlight";
  import Requests from "./requests.svelte";
  import requestsSource from "./requests.svelte?highlight";
  import ServerValues from "./server-values.svelte";
  import serverValuesSource from "./server-values.svelte?highlight";
  import Waits from "./waits.svelte";
  import waitsSource from "./waits.svelte?highlight";
</script>

Rendering on the server sends the browser a page that already shows your data. The reading hooks work on the server too; hooks that act only after mount, such as `useAtomMount` and `useAtomSubscribe`, do nothing there. Async atoms you `await` are computed during the request, and the page is sent once they have their values. [Hydration](/hydration) then sends the results of serializable atoms with the page, so the browser doesn't run those effects again.

You don't need `load` functions or server files for this. A component that awaits an atom is enough.

<Aside type="note" title="Before you start">

Server rendering needs Svelte's experimental async and a `RegistryProvider` at the root. See [Installation](/installation).

</Aside>

## One registry per request

On the server, `RegistryProvider` creates a fresh registry for each request. Every request computes its own atoms, so two visitors never see each other's state, even though they share the same atom definitions.

A request here means one page rendered on the server, not one visitor. When the same visitor loads another page from the server, that render gets another fresh registry, and nothing carries over from the last one. After the first page, the browser takes over: it has its own registry, which lasts for the rest of the visit, and following links within the app doesn't render on the server, so it creates no server registry at all.

During the render, the hooks hold every atom they read, so nothing is disposed while the render is waiting on something else. When the render ends, the provider disposes of the registry: effects are interrupted and finalizers run.

In the example, providers stand in for requests. Each makes its own registry, as the root layout's provider does for every request on the server, so each has its own `cartAtom`. `addedRef` is module state, which every request shares: see [Module state is shared between visitors](#module-state-is-shared-between-visitors).

<Example files={[{ html: requestSource, name: "request.svelte" }, { html: requestsSource, name: "requests.svelte" }]} hint="Click Add to cart in Request 1: only its cart grows, but addedRef counts it for every request. Then click Send another request: Request 3 starts with an empty cart, and a moment later Request 1 ends, its cart gone, while addedRef keeps its count."> <Requests /> </Example>

<Aside type="danger" title="Never pass the server a registry that outlives the request">

`RegistryProvider`'s `registry` option provides a registry you made yourself. On the server, one made at module level serves every request, so visitors share its atom values. The results sent to the browser for [hydration](/hydration) are read from it too, so one visitor's data can be written into another's page. Let the provider create the registry, as in [Installation](/installation#registry-options).

</Aside>

## Module state is shared between visitors

Only state in the request's registry is per request. A module is loaded once per server process, so anything it holds is shared by every request the server handles: an [`AtomRef`](/refs), `$state` in a `.svelte.ts` module, a store or a plain variable.

<Aside type="danger" title="Never write one visitor's data to module state on the server">

A value written there during a server render is what the next visitor's render reads, and it ends up in their HTML. That is a data leak, not just a bug.

</Aside>

**Example** (A signed-in user in a module-level ref)

```ts
// session.ts
import { AtomRef } from "effect/reactivity";

export const currentUser = AtomRef.make<{ name: string } | null>(null);
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { currentUser } from "$lib/session";

  const { children, data } = $props();
  if (data.user) {
    currentUser.set(data.user);
  }
</script>

{@render children()}
```

Alice signs in and loads a page: the server sets `currentUser` to Alice. Bob, who isn't signed in, loads a page next. His render doesn't set the ref, so it reads Alice, and his page says "Signed in as Alice". Setting it on every request, `null` included, doesn't fix it. With async rendering, requests take turns at each `await`, so Bob's render can read the ref just after Alice's has set it.

Module state is fine when it is the same for every visitor. Configuration, feature flags, constants, a cache of public data, a connection pool, a rate limiter or metrics can all live in a module. Reading shared state is fine. The danger is writing anything that belongs to one visitor or one request. Atom definitions are safe at module level for the same reason: an atom holds no value, and its values live in the request's registry.

For per-visitor state, use one of these instead:

- **An atom read through the hooks.** Each request gets its own registry, so each gets its own value. Give it the request's data with `initialValues` on `RegistryProvider` (see [Registry options](/installation#registry-options)) or [`useAtomInitialValues`](/sveltekit#starting-atoms-from-request-data).
- **A ref created inside a component.** A ref made in a component's script is new for each render. Pass it down as a prop, or through context.
- **A [scoped atom](/scoped-atoms),** for state that belongs to one part of the page, such as each open editor's draft.
- **A write in the browser only.** Event handlers and `$effect` never run on the server, so a module-level ref they write is shared only within one visitor's tab.

The library can't detect this for you: it can't tell a ref made at module level from one made in a component, and writes to a ref don't go through it.

## What the render waits for

A server render waits for the promises it awaits, and for nothing else. Whether an async atom's value makes it into the HTML depends on how you read it:

| Read with | On the server |
| --- | --- |
| `await useAtomResult(atom)` in the script | Waits for the first result. |
| `{await todos.current}` in markup, with `const todos = useAtomSuspense(atom)` in the script | Waits, unless it is inside a `<svelte:boundary>` with a `pending` snippet. |
| `useAtomSuspense` in a component inside a boundary with `pending` | Renders the `pending` snippet, and leaves the content to the browser. |
| `useAtomValue(atom)` | Doesn't wait, but still starts the atom. Renders whatever result the atom has when the render reaches it. |

`useAtomValue` starts the atom on the server as soon as the component sets up, so the result it renders depends on timing. Usually that is `Initial`, but if the atom finishes while the render waits on something else, it renders the value. The browser's first render usually starts from `Initial` again, so the two can disagree, and hydration can mismatch. Read data the first paint needs with one of the other hooks.

**Example** (Content that must be in the first paint)

```svelte
<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

  // A serializable async atom, such as an AtomRpc query with a serializationKey.
  const todos = useAtomSuspense(todosAtom);
</script>

<!-- No pending snippet, so the server waits for the list. -->
<ul>
  {#each await todos.current as todo (todo.id)}
    <li>{todo.title}</li>
  {/each}
</ul>
```

Use a `pending` snippet for content that can arrive later, such as anything below the fold, so it doesn't hold up the whole page.

<Aside type="caution" title="The server waits without a time limit">

A server render waits for every atom it awaits, however long it takes. A slow API holds up the whole page, and one that never answers holds it for good. Give the atom's effect a limit with `Effect.timeout`, so it fails instead, or put data the page can do without inside a boundary with a `pending` snippet.

</Aside>

The example reads four atoms in those four ways. Each atom records where it ran, and **In the HTML** shows what the page's HTML has in that place, fetched again from the server. On this site the server ran when the site was built: see [How these docs work](/introduction#how-these-docs-work).

<Example files={[{ html: waitsSource, name: "waits.svelte" }, { html: laterSource, name: "later.svelte" }]} hint="The first two rows were in the HTML, computed on the server. Click Reload the page and watch the last two: the HTML had a pending snippet and Initial, and the browser fills them in."> <Waits /> </Example>

<Aside type="caution" title="Call the hook inside the boundary">

A `pending` snippet only keeps the server from rendering what is inside the boundary. If `useAtomSuspense` reads a serializable atom in a script outside the boundary, the server still computes the atom to send its result with the page, and waits for it, though it renders the `pending` snippet. To leave the work to the browser, call the hook in a component inside the boundary, as `later.svelte` does.

</Aside>

## Server values

Some atoms shouldn't run on the server at all, such as one that reads `localStorage` or follows the window's focus. `Atom.withServerValue` gives the server a value to use instead. Every hook reads that value on the server, and the atom is never computed there:

**Example** (A window width the server can't know)

```ts
import { Atom } from "effect/reactivity";

const widthAtom = Atom.make((get) => {
  const update = () => get.setSelf(window.innerWidth);
  window.addEventListener("resize", update);
  get.addFinalizer(() => window.removeEventListener("resize", update));
  return window.innerWidth;
}).pipe(Atom.withServerValue(() => 1024));
```

Without the server value, reading `window` on the server would throw.

For an async atom, `Atom.withServerValueInitial` makes the server read it as `Initial`. What follows depends on the hook:

- **`useAtomResult`** has nothing to wait for, so the server renders the `Initial` result.
- **In the browser**, the hook runs the atom and waits for it as usual, so the component hydrates with the browser's result in place of the server's `Initial`.
- **`useAtomSuspense`** has nothing to resolve with, so on the server it rejects. Read it inside a `<svelte:boundary>` with a `pending` snippet, which the server renders instead.
- **Without that `pending` snippet**, the server render fails, and SvelteKit responds with a 500 status, even when a `failed` snippet catches the error. See [A failure on the server sets the status](/sveltekit#a-failure-on-the-server-sets-the-status).
- **A serializable atom** with a server value isn't passed to the browser, since the server never computed it.

An atom nothing has started, such as an `Atom.fn` no one has called, never leaves `Initial` either. On the server, `useAtomResult` and `useAtomSuspense` reject for it with an error that says so, rather than holding the response open. In the browser they wait, since something may still write it.

[Browser atoms](/browser) covers browser-only atoms in detail.

<Example files={[{ html: serverValuesSource, name: "server-values.svelte" }]} hint="Compare each value with what the HTML has: the server rendered 1024 and Initial. Then resize the window and watch the width follow."> <ServerValues /> </Example>

<Aside type="caution" title="Server values and getters">

A server value changes what the server renders, so the browser's first render can differ from the server's. That matters when the value picks which atom a component reads. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

</Aside>
