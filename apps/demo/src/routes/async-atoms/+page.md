---
title: Async atoms
description: Run an Effect in an atom and read its progress as an AsyncResult.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Connection from "./connection.svelte";
  import connectionSource from "./connection.svelte?highlight";
  import Die from "./die.svelte";
  import source from "./die.svelte?highlight";
  import feedSource from "./feed.svelte?highlight";
  import Kept from "./kept.svelte";
  import keptSource from "./kept.svelte?highlight";
  import keptReaderSource from "./kept-reader.svelte?highlight";
  import Sensor from "./sensor.svelte";
  import sensorSource from "./sensor.svelte?highlight";
</script>

An async atom runs an `Effect` to get its value, such as a request to a server or a database query. Its value also says whether the effect is still running, succeeded or failed, so a component can show a loading state, the value, or what went wrong.

If you haven't used Effect before, [Effect basics](/effect-basics) covers what this page and the ones after it need.

<Example files={[{ html: source, name: "die.svelte" }]} hint="Click Roll again: the old roll stays on screen, waiting, until the new one arrives. Then turn on Drop the die."> <Die /> </Example>

## Creating an async atom

Pass `Atom.make` an `Effect` instead of a value:

**Example** (An atom that rolls a die)

```ts
import { Effect, Random } from "effect";
import { Atom } from "effect/reactivity";

const dieAtom = Atom.make(
  Random.nextIntBetween(1, 6).pipe(Effect.delay("600 millis"))
);
```

The atom runs the effect the first time something reads it, not when you create it. When nothing holds it any more, the registry disposes of it and interrupts the effect if it is still running.

To read other atoms first, pass a function that receives `get` and returns the effect. The atom runs the effect again whenever an atom it read changes:

```ts
const todoAtom = Atom.make((get) => fetchTodo(get(selectedIdAtom)));
```

To wait for another async atom's value inside the effect, use `get.result(atom)`. It returns an `Effect` that waits for the atom's result, and fails with its error if it fails: see [Dependent queries](/cookbook#dependent-queries).

The live example reads the **Drop the die** toggle this way. Turn it on, and the atom runs its effect again, which now fails.

## AsyncResult

An async atom's value is an `AsyncResult`, which is one of three states:

| `_tag` | Means |
| --- | --- |
| `Initial` | No result yet. |
| `Success` | The effect succeeded. The result is in `value`. |
| `Failure` | The effect failed. The reason is in `cause`, a `Cause` from Effect. |

Every state also has a `waiting` flag, which is `true` while the effect is running. A `Success` that is `waiting` still has the last value, so you can keep showing it while a new one loads, as the example does by dimming it. The history under the example lists every state the atom has been through, and when.

An effect that finishes without waiting for anything, such as `Effect.succeed(3)`, gives its result straight away: the atom is never `Initial` or `waiting`.

Read the result with `useAtomValue`, and check `_tag` in the markup:

**Example** (Rendering each state)

```svelte
<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  const todo = useAtomValue(todoAtom);
</script>

{#if todo.current._tag === "Success"}
  <p>{todo.current.value.title}</p>
{:else if todo.current._tag === "Failure"}
  <p>Could not load the todo.</p>
{:else}
  <p>Loading…</p>
{/if}
```

To say why it failed, find the typed error in the `cause` with `Cause.findErrorOption`, as [Effect basics](/effect-basics#exit-and-cause) describes. [Errors](/errors) covers each kind of failure.

<Aside type="tip" title="Await instead of checking tags">

With Svelte's experimental async turned on, you can `await` an async atom in markup and let `<svelte:boundary>` handle loading and failure. See [Suspense](/suspense).

</Aside>

## Running it again

`useAtomRefresh` returns a function that runs the atom's effect again:

```ts
const roll = useAtomRefresh(dieAtom);
```

While it runs, the atom keeps its previous result with `waiting` set to `true`, so a refresh doesn't take the value away. The hook also [holds](/reading-and-writing#reading) the atom for as long as the component lives, so the refreshed result is kept even while nothing on screen reads it.

## Working with AsyncResult

The `AsyncResult` module, exported from `effect/reactivity`, has functions that save you checking `_tag` by hand.

`AsyncResult.match` takes a function for each state and returns what the matching one returns. It suits a `$derived`:

**Example** (A label for each state)

```ts
const label = $derived(
  AsyncResult.match(todo.current, {
    onFailure: () => "Could not load the todo.",
    onInitial: () => "Loading…",
    onSuccess: (success) => success.value.title,
  })
);
```

`AsyncResult.getOrElse` gives the value, or a fallback when there is none yet. It also falls back to the last successful value when the effect fails after succeeding before, so a failed refresh doesn't empty the screen:

**Example** (A count that is 0 until the todos load)

```ts
const count = $derived(AsyncResult.getOrElse(todos.current, () => []).length);
```

The live example reads one atom both ways. While the sensor is offline, `match` says so, and `getOrElse` still shows the last reading.

<Example files={[{ html: sensorSource, name: "sensor.svelte" }]} hint="Wait for a reading, then turn on Offline: match reports the failure, while getOrElse keeps the last temperature. Click Read again while offline: it still does."> <Sensor /> </Example>

[Streams](/streams) uses `getOrElse` to show `starting` until a stream's first item arrives. Other functions in the module:

| Function | Does |
| --- | --- |
| `AsyncResult.isSuccess`, `isFailure`, `isInitial` | Check the state, narrowing the type. |
| `AsyncResult.value` | The value, or the last successful one, as an `Option`. |
| `AsyncResult.error` | The typed error of a `Failure`, as an `Option`. |
| `AsyncResult.matchWithError` | Like `match`, but a `Failure` goes to `onError` with its typed error, or to `onDefect` when it has none. |
| `AsyncResult.matchWithWaiting` | Like `matchWithError`, with `onWaiting` for `Initial` and for any result that is `waiting`. |
| `AsyncResult.builder` | Handles one case at a time, as in `AsyncResult.builder(result).onSuccess(f).onErrorTag("NotFound", g).orNull()`. |
| `AsyncResult.map` | Transform the value of a `Success`, as in `result.pipe(AsyncResult.map(f))`. |
| `AsyncResult.all` | Combine several results into one, which succeeds only when all of them have. |

## Keeping results

An async atom has the same [lifetime](/lifetimes) as any other: when nothing holds it, the registry disposes of its result, and the next read runs the effect again. To keep a result, use `Atom.keepAlive` or an idle TTL:

**Example** (A cache that survives navigation)

```ts
const settingsAtom = Atom.make(loadSettings).pipe(Atom.keepAlive);

const searchAtom = Atom.make(search).pipe(Atom.setIdleTTL("1 minute"));
```

Here the settings load once per registry, which is once per session in the browser. The search result is kept for a minute after you navigate away, so going back within that minute shows it straight away.

The live example has these two atoms on a dashboard, with the TTL cut to 3 seconds, beside a plain `weatherAtom`. A help page reads none of them. The cards below the pages count how many times each request has run, and show what the registry holds for each atom.

<Example files={[{ html: keptSource, name: "kept.svelte" }, { html: keptReaderSource, name: "kept-reader.svelte" }]} hint="Open the dashboard, then go to Help and back. weatherAtom loads again every time, settingsAtom never does, and searchAtom loads again only if you stayed away longer than its 3 seconds."> <Kept /> </Example>

## Releasing resources

An async atom's effect runs in a `Scope` that lasts as long as the atom's value. Anything the effect acquires with `Effect.acquireRelease` or `Effect.addFinalizer` is released when the atom is disposed, or before its effect runs again:

**Example** (A connection that closes with the atom)

```ts
const feedAtom = Atom.make(
  Effect.gen(function* () {
    const socket = yield* Effect.acquireRelease(openSocket, (socket) =>
      Effect.sync(() => socket.close())
    );
    return yield* readFirstMessage(socket);
  })
);
```

<Example files={[{ html: connectionSource, name: "connection.svelte" }, { html: feedSource, name: "feed.svelte" }]} hint="Turn on Read feedAtom: the atom opens a socket. Click Reconnect: the old socket closes before the new one opens. Then turn it off: the last socket closes."> <Connection /> </Example>

This is the effect version of `get.addFinalizer`, described in [Lifetimes](/lifetimes#finalizers).
