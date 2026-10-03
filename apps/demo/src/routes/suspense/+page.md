---
title: Suspense
description: Await async atoms in markup, and let a boundary show loading and failure.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Failure from "./failure.svelte";
  import failureSource from "./failure.svelte?highlight";
  import Slow from "./slow.svelte";
  import slowSource from "./slow.svelte?highlight";
</script>

Checking an `AsyncResult`'s `_tag` in every component gets repetitive. With Svelte's experimental async, you can `await` an async atom directly in markup instead. A `<svelte:boundary>` around it shows a loading state until the value arrives, and an error state if it fails.

<Example files={[{ html: slowSource, name: "slow.svelte" }]}> <Slow /> </Example>

<Aside type="note">

The hooks on this page need `experimental.async` turned on in Svelte's compiler options. See [Installation](/installation#turn-on-async-mode).

</Aside>

## Awaiting in markup

`useAtomSuspense` takes an async atom and returns an object whose `current` is a promise of the atom's value. Await it inside a boundary with a `pending` snippet:

**Example** (Loading a value)

```svelte
<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

  const todo = useAtomSuspense(todoAtom);
</script>

<svelte:boundary>
  <p>{(await todo.current).title}</p>

  {#snippet pending()}
    <p>Loading…</p>
  {/snippet}
</svelte:boundary>
```

The promise stays the same object while the atom's result is unchanged, so Svelte only renders again when there is something new. When the result changes, `current` is a new promise.

## Refreshing

Svelte shows a boundary's `pending` snippet only while the boundary first loads. After that, it keeps the current content on screen while new values load. Use `$effect.pending()` if you want to show that something is loading.

What a refresh does to the promise depends on `suspendOnWaiting`:

- **By default**, a refresh resolves straight away with the value the atom already has, then again with the new value once it arrives.
- **With `suspendOnWaiting: true`**, a refreshing atom counts as loading, so the promise waits until the new value is ready.

The live example reads one atom both ways. Click **Refresh** and watch when each line changes.

## Handling failure

When the atom's effect fails, the promise rejects with the error, and the boundary renders its `failed` snippet instead:

<Example files={[{ html: failureSource, name: "failure.svelte" }]}> <Failure /> </Example>

<Aside type="caution" title="SvelteKit hides error details">

SvelteKit passes an error through its `handleError` hook before a `failed` snippet sees it, and the default hook replaces it with `{ message: "Internal Error" }`. The hooks from `effect-atom-svelte/sveltekit` keep an Effect error's `_tag`. See [SvelteKit](/sveltekit#errors-in-boundaries).

</Aside>

To handle typed errors yourself rather than through the boundary, pass `includeFailure: true`. The promise then resolves with the whole `Success` or `Failure` result, and never rejects:

**Example** (Handling a typed error in place)

```svelte
<script lang="ts">
  const todo = useAtomSuspense(todoAtom, { includeFailure: true });
</script>

<svelte:boundary>
  {@const result = await todo.current}
  {#if result._tag === "Success"}
    <p>{result.value.title}</p>
  {:else}
    <p>Could not load the todo.</p>
  {/if}
</svelte:boundary>
```

## Awaiting in the script

`useAtomResult` waits in the component's script instead. `await` it at the top level of the script. It resolves once the atom has its first result, and returns a live `AsyncResult` like `useAtomValue` does:

**Example** (Waiting for the first result)

```svelte
<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  const todos = await useAtomResult(todosAtom);
</script>

{#if todos.current._tag === "Success"}
  <p>{todos.current.value.length} todos</p>
{/if}
```

The await happens once. After that, `todos.current` updates like any other read, including `waiting` while a refresh runs. On the server, rendering waits for it. If the atom has a serialization key, the browser reuses the server's result when it hydrates rather than running the effect again. See [Hydration](/hydration). [RPC](/rpc) shows this with a real query.

### Awaiting more than one atom

You can call hooks before and after top-level `await`s, because Svelte restores the component's context after each one. Awaiting atoms one after another runs their effects one after another, though. When they don't depend on each other, start them together:

```ts
const [todos, user] = await Promise.all([
  useAtomResult(todosAtom),
  useAtomResult(userAtom),
]);
```

<Aside type="caution" title="Only top-level awaits">

A hook can't be called after an `await` inside a function of your own, such as an `async` helper. Svelte only restores the component's context after top-level awaits in the script.

</Aside>

### Event handlers after an await

In Svelte 5.57, a production build attaches event handlers before the script has finished its top-level awaits. A handler that a hook returns after an `await` is still `undefined` at that point, so `onclick={refresh}` does nothing. Development builds don't show the problem.

**Example** (A refresh button that works)

```svelte
<script lang="ts">
  // Called before the await, so `refresh` exists when the button is set up.
  const refresh = useAtomRefresh(todosAtom);
  const todos = await useAtomResult(todosAtom);
</script>

<button onclick={refresh}>Refresh</button>
```

Either call such hooks before the first `await`, or wrap the handler in an arrow function, `onclick={() => refresh()}`, which looks `refresh` up when the button is clicked.

## Following a different atom

Both hooks accept a getter, like every other hook. They then follow whichever atom it returns:

- `useAtomSuspense(() => todoAtom(id))` issues a new promise when `id` changes, and the boundary awaits the new atom.
- `await useAtomResult(() => todoAtom(id))` waits only for the first atom. When `id` changes, `current` moves to the new atom's result, which is usually `Initial` until it loads, and the script's `await` doesn't run again. Use `useAtomSuspense` when a change should wait for the new value.

<Aside type="note" title="Abandoned reads let go">

When a getter moves to another atom while the old one is still loading, or the component is destroyed, the old wait stops holding its atom. The registry then disposes of the atom and interrupts its request. The abandoned promise rejects with Svelte's own abort reason, which Svelte ignores, so the boundary keeps waiting for the new value rather than showing an interruption.

A promise from `useAtomSuspense` that you await outside markup, `$derived` or `$effect`, such as at the top level of the script or in an event handler, is held until the component is destroyed.

</Aside>
