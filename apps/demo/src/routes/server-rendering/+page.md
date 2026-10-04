---
title: Server rendering
description: What happens to atoms when a page renders on the server, and what the render waits for.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

Rendering on the server sends the browser a page that already shows your data. The reading hooks work on the server too; hooks that act only after mount, such as `useAtomMount` and `useAtomSubscribe`, do nothing there. Async atoms you `await` are computed during the request, and the page is sent once they have their values. [Hydration](/hydration) then carries those values to the browser, so it doesn't run the same effects again.

You don't need `load` functions or server files for this. A component that awaits an atom is enough.

<Aside type="note" title="Before you start">

Server rendering needs Svelte's experimental async and a `RegistryProvider` at the root. See [Installation](/installation).

</Aside>

## One registry per request

On the server, `RegistryProvider` creates a fresh registry for each request. Every request computes its own atoms, so two visitors never see each other's state, even though they share the same atom definitions.

During the render, the hooks hold every atom they read, so nothing is disposed while the render is waiting on something else. When the render ends, the provider disposes of the registry: effects are interrupted and finalizers run.

If you pass your own registry to `RegistryProvider` with `registry`, it outlives the request. The hooks release the atoms the request read, but the registry itself stays for you to dispose of. Each request still sends the browser only its own [hydration](/hydration) results.

<Aside type="caution" title="State outside the registry is shared">

Only state in the request's registry is per request. Anything held at module level, such as an [`AtomRef`](/refs) or a plain variable, is shared by every request the server handles.

</Aside>

## What the render waits for

A server render waits for the promises it awaits, and for nothing else. Whether an async atom's value makes it into the HTML depends on how you read it:

| Read with | On the server |
| --- | --- |
| `await useAtomResult(atom)` in the script | Waits for the first result. |
| `{await todos.current}` in markup, with `const todos = useAtomSuspense(atom)` in the script | Waits, unless it is inside a `<svelte:boundary>` with a `pending` snippet. |
| `useAtomSuspense` inside a boundary with `pending` | Renders the `pending` snippet, and leaves the content to the browser. |
| `useAtomValue(atom)` | Doesn't wait. Renders the current result, usually `Initial`. |

**Example** (Content that must be in the first paint)

```svelte
<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

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

For an async atom, `Atom.withServerValueInitial` makes the server read it as `Initial`. `useAtomResult` has nothing to wait for, so the server renders the `Initial` result and the browser runs the atom once the page has hydrated. `useAtomSuspense` has nothing to resolve with, so on the server it rejects: read it inside a `<svelte:boundary>` with a `pending` snippet, which the server renders instead. A serializable atom with a server value isn't passed to the browser, since the server never computed it. [Browser atoms](/browser) covers browser-only atoms in detail.

<Aside type="caution" title="Server values and getters">

A server value changes what the server renders, so the browser's first render can differ from the server's. That matters when the value picks which atom a component reads. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

</Aside>
