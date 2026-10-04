---
title: Suspense
description: Await async atoms in markup, and let a boundary show loading and failure.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Failure from "./failure.svelte";
  import failureSource from "./failure.svelte?highlight";
  import Follow from "./follow.svelte";
  import followSource from "./follow.svelte?highlight";
  import notesSource from "./notes.svelte?highlight";
  import ScriptAwait from "./script-await.svelte";
  import scriptAwaitSource from "./script-await.svelte?highlight";
  import Slow from "./slow.svelte";
  import slowSource from "./slow.svelte?highlight";
</script>

Checking an `AsyncResult`'s `_tag` in every component gets repetitive. With Svelte's experimental async, you can `await` an async atom directly in markup instead. A `<svelte:boundary>` around it shows a loading state until the value arrives, and an error state if it fails. React calls this suspense, hence the hook's name, `useAtomSuspense`.

Three hooks read an async atom. Choose by where you want to wait:

| Hook | Waits | Failure |
| --- | --- | --- |
| `useAtomValue(atom)` | Never. `current` is the `AsyncResult`, `Initial` until the first result. See [Async atoms](/async-atoms). | A `Failure` result to check. |
| `useAtomSuspense(atom)` | In markup: `await` its `current` inside a `<svelte:boundary>`. | The boundary's `failed` snippet. |
| `await useAtomResult(atom)` | In the script, for the first result. Then `current` is a live `AsyncResult`. | A `Failure` result to check. |

On the server, the choice also decides what the first paint contains. See [What the render waits for](/server-rendering#what-the-render-waits-for).

<Example files={[{ html: slowSource, name: "slow.svelte" }]} hint="Click Refresh on each side, then compare the timelines. The default await resolves at once with the old value; the suspendOnWaiting one waits for the new value, while $effect.pending() counts 1."> <Slow /> </Example>

<Aside type="note" title="Needs async mode">

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

Svelte shows a boundary's `pending` snippet only while the boundary first loads. After that, it keeps the current content on screen while new values load, and `$effect.pending()` inside the boundary counts the awaits it is still waiting for. Use it to show that something is loading.

What a refresh does to the promise depends on `suspendOnWaiting`:

- **By default**, a refreshing atom still has its value, so the promise resolves straight away with that value. The boundary has nothing to wait for, and `$effect.pending()` stays 0. When the new value arrives, `current` is a new promise, which resolves with it.
- **With `suspendOnWaiting: true`**, a refreshing atom counts as loading, so the promise waits until the new value is ready. The boundary keeps showing the old value, and `$effect.pending()` is 1 until the new one arrives.

The live example reads two copies of one slow atom, one each way. Under each side, the timeline and the log show the atom's own `AsyncResult` and what the side's `await` resolved with, timed from the refresh. On both sides the atom is `Success, waiting` from the moment you click. On the default side, the `await` resolves a few milliseconds later with the old value, then again with the new one at about 800 ms. On the `suspendOnWaiting` side it resolves once, at about 800 ms, with the new value.

<Aside type="caution" title="One update waits for all of its awaits">

Svelte shows an update only once every `await` it changed, in every boundary already showing content, has resolved. A refresh of one atom changes all of its reads in the same update, so if one atom is read both ways, the `suspendOnWaiting` read holds back the default one too, along with anything else the refresh changed, such as a `waiting` spinner from `useAtomValue`. That is why the example uses two atoms.

</Aside>

Choose the default to keep the page responsive: the old value stays on screen, and the rest of the update, such as a spinner from `waiting`, shows at once. Choose `suspendOnWaiting` when old and new data must never appear together, such as a total next to the list it adds up: the update lands all at once, when the new value is ready.

## Handling failure

When the atom's effect fails, the promise rejects with the error, and the boundary renders its `failed` snippet instead:

<Example files={[{ html: failureSource, name: "failure.svelte" }]}> <Failure /> </Example>

<Aside type="caution" title="SvelteKit hides error details">

SvelteKit passes an error through its `handleError` hook before a `failed` snippet sees it, and the default hook replaces it with `{ message: "Internal Error" }`. The example reads `error.message` and `error.tag` because this site installs the hooks from `effect-atom-svelte/sveltekit`, which keep an Effect error's message and `_tag`. Without them, the snippet would show "Internal Error" and no tag. [SvelteKit](/sveltekit#errors-in-boundaries) shows how to install them.

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

The script waits only once. From then on, `todos.current` updates like a `useAtomValue` read, and shows `waiting` while a refresh runs.

In the live example, a `<Notes>` component awaits `useAtomResult` in its script, inside a boundary with a `pending` snippet. The log shows when its script started and when it continued past the `await`.

<Example files={[{ html: scriptAwaitSource, name: "script-await.svelte" }, { html: notesSource, name: "notes.svelte" }]} hint="Click Mount the component: the boundary shows its pending snippet until the script's await resolves. Then click Refresh: current shows waiting, and the script doesn't run again."> <ScriptAwait /> </Example>

On the server, the render waits for the first result too. If the atom has a serialization key, the browser starts from the server's result instead of running the effect again: see [Hydration](/hydration). [RPC](/rpc) shows this with a real query.

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

A button whose handler comes from a hook called after an `await` can do nothing in a production build. See [Handlers after an await](/troubleshooting#handlers-after-an-await).

## Following a different atom

Both hooks accept a getter, like the other hooks that take an atom. They then follow whichever atom it returns:

- `useAtomSuspense(() => todoAtom(id))` issues a new promise when `id` changes, and the boundary awaits the new atom.
- `await useAtomResult(() => todoAtom(id))` waits only for the first atom. When `id` changes, `current` moves to the new atom's result, which is usually `Initial` until it loads, and the script's `await` doesn't run again. Use `useAtomSuspense` when a change should wait for the new value.

<Example files={[{ html: followSource, name: "follow.svelte" }]} hint="Pick another note: the boundary keeps the old one on screen while $effect.pending() is 1, and the log shows the new note's effect running. Then pick two notes quickly, one after the other: the first one's effect is interrupted."> <Follow /> </Example>

<Aside type="note" title="Abandoned waits">

When a getter moves to another atom while the old one is still loading, or the component is destroyed, the hook stops holding the old atom. The registry then disposes of it and interrupts its effect. The old promise rejects with Svelte's own abort reason, which Svelte ignores, so the boundary keeps waiting for the new value rather than showing an interruption.

A promise from `useAtomSuspense` that you await outside markup, `$derived` or `$effect`, such as at the top level of the script or in an event handler, is held until the component is destroyed.

</Aside>
