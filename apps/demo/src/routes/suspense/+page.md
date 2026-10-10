---
title: Suspense
description: Await async atoms in markup, and let a boundary show loading and failure.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Awaits from "./awaits.svelte";
  import combinedSource from "./combined.svelte?highlight";
  import awaitsSource from "./awaits.svelte?highlight";
  import FirstLoad from "./first-load.svelte";
  import firstLoadSource from "./first-load.svelte?highlight";
  import forecastSource from "./forecast.svelte?highlight";
  import notesSource from "./notes.svelte?highlight";
  import oneByOneSource from "./one-by-one.svelte?highlight";
  import Retry from "./retry.svelte";
  import retrySource from "./retry.svelte?highlight";
  import ScriptAwait from "./script-await.svelte";
  import scriptAwaitSource from "./script-await.svelte?highlight";
  import SlowTraces from "./slow-traces.svelte";
  import slowSource from "./slow.svelte?highlight";
  import togetherSource from "./together.svelte?highlight";
  import Weather from "./weather.svelte";
  import weatherSource from "./weather.svelte?highlight";
</script>

Checking an `AsyncResult`'s `_tag` in every component gets repetitive. With Svelte's experimental async, you can `await` an async atom directly in markup instead. A `<svelte:boundary>` around it shows a loading state until the value arrives, and an error state if it fails. React calls this suspense, hence the hook's name, `useAtomSuspense`.

<Aside type="note" title="Needs async mode">

The hooks on this page need `experimental.async` turned on in Svelte's compiler options. See [Installation](/installation#turn-on-async-mode).

</Aside>

In the example, a component awaits a slow atom inside a boundary. Under it, the inspector lights up the branch the boundary renders:

<Example files={[{ html: forecastSource, name: "forecast.svelte" }, { html: firstLoadSource, name: "first-load.svelte" }]} hint="Turn on Mount the forecast: the boundary shows its pending snippet until the forecast arrives, then the content. Turn it off and on again: nothing kept the atom, so it loads again."> <FirstLoad /> </Example>

## Awaiting in markup

`useAtomSuspense` takes an async atom and returns an object whose `current` is a promise of the atom's value. Await it inside a boundary with a `pending` snippet, which shows until the first value arrives:

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

Await `current` in markup, `$derived` or `$effect`, and the hook holds the atom only while that read lasts. A promise you await anywhere else, such as at the top level of the script or in an event handler, holds the atom until it settles or the component is destroyed, whichever comes first.

## After the first load

Svelte shows a boundary's `pending` snippet only while the boundary first loads. After that, it keeps the current content on screen while new values load, and `$effect.pending()` inside the boundary counts the awaits it is still waiting for. Use it to show that something is loading, as the weather example's Updating… does:

```svelte
{#if $effect.pending() > 0}
  <p>Updating…</p>
{/if}
```

### Following a different atom

Like the other hooks that take an atom, `useAtomSuspense` accepts a getter, and follows whichever atom it returns. `useAtomSuspense(() => weatherAtom(city))` issues a new promise when `city` changes, and the boundary waits for the new atom while the old content stays.

In the example, `weatherAtom` is an [`Atom.family`](/families), with one atom per city. Each is wrapped in `Atom.withServerValueInitial`, so the server doesn't run the load and renders the `pending` snippet instead, and the browser loads it: see [Server values](/server-rendering#server-values).

<Example files={[{ html: weatherSource, name: "weather.svelte" }]} hint="Click another city: the old forecast stays, with Updating…, and the pending snippet doesn't come back. Click two cities quickly: the log shows the first one's load interrupted."> <Weather /> </Example>

<Aside type="note" title="Abandoned waits">

When a getter moves to another atom while the old one is still loading, or the component is destroyed, the hook stops holding the old atom. The registry then disposes of it and interrupts its effect: click two cities quickly in the example, and the log shows the first one's load interrupted. The old promise rejects with Svelte's own abort reason, which Svelte ignores, so the boundary keeps waiting for the new value rather than showing an interruption.

</Aside>

### Refreshing, and suspendOnWaiting

What a refresh does to the promise depends on `suspendOnWaiting`:

- **By default**, a refreshing atom still has its value, so the promise resolves straight away with that value. The boundary has nothing to wait for, and `$effect.pending()` stays 0. When the new value arrives, `current` is a new promise, which resolves with it.
- **With `suspendOnWaiting: true`**, a refreshing atom counts as loading, so the promise waits until the new value is ready. The boundary keeps showing the old value, and `$effect.pending()` is 1 until the new one arrives.

The example reads two copies of one slow atom, one each way. Refresh both, and compare when each side's `await` resolves: on the default side at once, with the old value, then again with the new one; on the `suspendOnWaiting` side once, with the new value.

<Example files={[{ html: slowSource, name: "slow.svelte" }]} hint="Click Refresh both, then compare the timelines: the default await resolves at once with the old value, and again two seconds later; the suspendOnWaiting one resolves once, with the new value, while $effect.pending() counts 1."> <SlowTraces /> </Example>

<Aside type="caution" title="One update waits for all of its awaits">

Svelte shows an update only once every `await` it changed has resolved. A refresh changes every read of the atom at once, so a `suspendOnWaiting` read also holds back the atom's default reads, and anything else the refresh changed. That is why the example uses two atoms.

</Aside>

Choose the default to keep the page responsive: the old value stays on screen, and the rest of the update, such as a spinner from `waiting`, shows at once. Choose `suspendOnWaiting` when old and new data must never appear together, such as a total next to the list it adds up, or when the content must wait for a retry, as in the `failed` snippet below.

## When it fails

When the atom's effect fails, the promise rejects with `Cause.squash` of its cause: the typed error if there is one, otherwise the defect, and otherwise an `Error` saying the effect was interrupted. The boundary then renders its `failed` snippet. The snippet gets the error and a `reset` function, which renders the boundary's content again. Refresh the atom first, so the content has a new result to wait for:

**Example** (Trying again)

```svelte
<script lang="ts">
  const todo = useAtomSuspense(todoAtom, { suspendOnWaiting: true });
  const refresh = useAtomRefresh(todoAtom);
</script>

<!-- In the boundary around (await todo.current): -->
{#snippet failed(error, reset)}
  <p>{(error as App.Error).message}</p>
  <button
    onclick={() => {
      refresh();
      reset();
    }}
  >
    Try again
  </button>
{/snippet}
```

`suspendOnWaiting: true` matters here. Without it, a failed atom that is refreshing still counts as settled, so the content rejects again at once with the old failure, and the `failed` snippet comes straight back.

Like the weather example's, this example's atom loads in the browser only. A failure rendered on the server makes SvelteKit respond with a 500: see [A failure on the server sets the status](/sveltekit#a-failure-on-the-server-sets-the-status). Turn on **Fail the next load** to try the `failed` snippet:

<Example files={[{ html: retrySource, name: "retry.svelte" }]} hint="Turn on Fail the next load and click Reload: the failed snippet takes over. Click Try again: reset starts the boundary afresh, so the pending snippet shows until the new forecast arrives."> <Retry /> </Example>

<Aside type="caution" title="SvelteKit hides error details">

SvelteKit passes the error through its `handleError` hook before a `failed` snippet sees it, and the default hook replaces it with `{ message: "Internal Error" }`. The example can read `error.message` because this site installs the hooks from `effect-atom-svelte/sveltekit`: see [SvelteKit's `handleError`](/errors#sveltekits-handleerror).

</Aside>

To handle typed errors yourself rather than through the boundary, pass `includeFailure: true`. The promise then resolves with the whole `Success` or `Failure` result, and never rejects: see [In place, with `includeFailure`](/errors#in-place-with-includefailure).

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

`useAtomResult` takes two options. `suspendOnWaiting: true` makes the first `await` also wait for a refresh that is already running, instead of resolving with the result it is refreshing. `revalidateOnHydrate` runs a server-rendered atom again in the browser: see [Running again after hydration](/hydration#running-again-after-hydration). `useAtomSuspense` takes both too.

An atom nothing has started, such as an `Atom.fn` no one has called, has no first result to wait for. In the browser, the `await` stays pending until something calls it. On the server, it rejects, so the render doesn't wait forever: see [Server values](/server-rendering#server-values).

In the example, a `<Notes>` component awaits `useAtomResult` in its script, inside a boundary with a `pending` snippet. Under it, its script's lines show where the script has got to:

<Example files={[{ html: scriptAwaitSource, name: "script-await.svelte" }, { html: notesSource, name: "notes.svelte" }]} hint="Turn on Mount the component: the script stops at the await while the boundary shows its pending snippet, and carries on once the atom has its first result. Then click Refresh: current shows waiting, and the script doesn't run again."> <ScriptAwait /> </Example>

On the server, the render waits for the first result too. If the atom has a serialization key, the browser starts from the server's result instead of running the effect again: see [Hydration](/hydration). [RPC](/rpc) shows this with a real query.

### Awaiting more than one atom

Awaiting atoms one after another runs their effects one after another. When they don't depend on each other, start them together: with `Promise.all` over the hooks' promises, or by combining their effects in one atom with `Effect.all`. `Effect.all` also runs effects one after another unless you pass it a `concurrency`.

Svelte restores the component's context after each top-level `await`, so you can call hooks after one. But Svelte stops hydrating at the first `await`, so a serializable atom read after it runs again in the browser instead of starting from the server's result: one more reason to start them together. See [Call hooks before the first await](/hydration#call-hooks-before-the-first-await).

Below, each component loads todos and a user, which take a second and a half each. The timelines show when each load starts and ends. The three also differ when a load fails:

- **One by one** and **`Promise.all`** wait for every load, because `useAtomResult` resolves with a `Failure` rather than rejecting.
- **`Effect.all`** stops at the first failure and interrupts the other loads.

<Example files={[{ html: oneByOneSource, name: "one-by-one.svelte" }, { html: togetherSource, name: "together.svelte" }, { html: combinedSource, name: "combined.svelte" }, { html: awaitsSource, name: "awaits.svelte" }]} hint="Turn on Mount all three: one by one is ready after three seconds, the other two after one and a half. Then turn on Todos fails, which unmounts them, and turn on Mount all three again: only Effect.all interrupts the user's load."> <Awaits /> </Example>

<Aside type="caution" title="Only top-level awaits">

A hook can't be called after an `await` inside a function of your own, such as an `async` helper. Svelte only restores the component's context after top-level awaits in the script.

</Aside>

## Choosing a hook

Three hooks read an async atom. Choose by where you want to wait:

| Hook | Waits | Failure |
| --- | --- | --- |
| `useAtomValue(atom)` | Never. `current` is the `AsyncResult`, `Initial` until the first result. See [Async atoms](/async-atoms). | A `Failure` result to check. |
| `useAtomSuspense(atom)` | In markup: `await` its `current` inside a `<svelte:boundary>`. | The boundary's `failed` snippet. |
| `await useAtomResult(atom)` | In the script, for the first result. Then `current` is a live `AsyncResult`. | A `Failure` result to check. |

On the server, the choice also decides what the first paint contains. See [What the render waits for](/server-rendering#what-the-render-waits-for).
