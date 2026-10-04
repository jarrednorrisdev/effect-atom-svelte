---
title: Async atoms
description: Run an Effect in an atom and read its progress as an AsyncResult.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Die from "./die.svelte";
  import source from "./die.svelte?highlight";
</script>

Most state worth keeping comes from somewhere slow: a server, a database, a file. An async atom runs an `Effect` to get its value, and tells you where it has got to, so a component can show a loading state, the value, or what went wrong.

If you haven't used Effect before, [Effect basics](/effect-basics) covers what this page and the ones after it need.

<Example files={[{ html: source, name: "die.svelte" }]}> <Die /> </Example>

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

The atom runs the effect the first time something reads it, not when you create it. When nothing reads it any more, the registry disposes of it and interrupts the effect if it is still running.

To read other atoms first, pass a function that receives `get` and returns the effect. The atom runs the effect again whenever an atom it read changes:

```ts
const todoAtom = Atom.make((get) => fetchTodo(get(selectedIdAtom)));
```

The live example reads the **Drop the die** checkbox this way. Tick it, and the atom runs its effect again, which now fails.

## AsyncResult

An async atom's value is an `AsyncResult`, which is one of three states:

| `_tag` | Means |
| --- | --- |
| `Initial` | No result yet. |
| `Success` | The effect succeeded. The result is in `value`. |
| `Failure` | The effect failed. The reason is in `cause`, a `Cause` from Effect. |

Every state also has a `waiting` flag, which is `true` while the effect is running. A `Success` that is `waiting` still has the last value, so you can keep showing it while a new one loads, as the example does by fading it.

Read the result with `useAtomValue`, and check `_tag` in the markup:

**Example** (Rendering each state)

```svelte
<script lang="ts">
  import { Cause } from "effect";
  import { useAtomValue } from "effect-atom-svelte";

  const todo = useAtomValue(todoAtom);
</script>

{#if todo.current._tag === "Success"}
  <p>{todo.current.value.title}</p>
{:else if todo.current._tag === "Failure"}
  <p>Could not load: {Cause.pretty(todo.current.cause)}</p>
{:else}
  <p>Loading…</p>
{/if}
```

<Aside type="tip" title="Await instead of checking tags">

With Svelte's experimental async turned on, you can `await` an async atom in markup and let `<svelte:boundary>` handle loading and failure. See [Suspense](/suspense).

</Aside>

## Working with AsyncResult

The `AsyncResult` module, exported from `effect/reactivity`, has functions that save you checking `_tag` by hand.

`AsyncResult.match` takes a function for each state and returns what the matching one returns. It suits a `$derived`:

**Example** (A label for each state)

```svelte
<script lang="ts">
  import { Cause } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";

  const todo = useAtomValue(todoAtom);

  const label = $derived(
    AsyncResult.match(todo.current, {
      onFailure: (failure) => `Could not load: ${Cause.pretty(failure.cause)}`,
      onInitial: () => "Loading…",
      onSuccess: (success) => success.value.title,
    })
  );
</script>

<p>{label}</p>
```

`AsyncResult.getOrElse` gives the value, or a fallback when there is none yet. It also falls back to the last successful value when the effect fails after succeeding before, so a failed refresh doesn't empty the screen:

**Example** (A count that is 0 until the todos load)

```ts
const count = $derived(AsyncResult.getOrElse(todos.current, () => []).length);
```

[Streams](/streams) uses it to show `starting` until a stream's first item arrives. Other functions in the module:

| Function | Does |
| --- | --- |
| `AsyncResult.isSuccess`, `isFailure`, `isInitial` | Check the state, narrowing the type. |
| `AsyncResult.value` | The value, or the last successful one, as an `Option`. |
| `AsyncResult.error` | The typed error of a `Failure`, as an `Option`. |
| `AsyncResult.map` | Transform the value of a `Success`, as in `result.pipe(AsyncResult.map(f))`. |
| `AsyncResult.all` | Combine several results into one, which succeeds only when all of them have. |

## Running it again

`useAtomRefresh` returns a function that runs the atom's effect again:

```ts
const roll = useAtomRefresh(dieAtom);
```

While it runs, the atom keeps its previous result with `waiting` set to `true`, so a refresh doesn't take the value away. The hook also keeps the atom mounted for as long as the component lives, so a refresh is never lost because nothing was reading.

## Keeping results

An async atom has the same [lifetime](/lifetimes) as any other: when nothing reads it, the registry disposes of its result, and the next read runs the effect again. To keep a result, use `Atom.keepAlive` or an idle TTL:

**Example** (A cache that survives navigation)

```ts
const settingsAtom = Atom.make(loadSettings).pipe(Atom.keepAlive);

const searchAtom = Atom.family((term: string) =>
  Atom.make(search(term)).pipe(Atom.setIdleTTL("1 minute"))
);
```

Here the settings load once per registry, which is once per session in the browser. Each search result is kept for a minute after you navigate away, so going back shows it straight away.

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

This is the effect version of `get.addFinalizer`, described in [Lifetimes](/lifetimes#finalizers).

## Services

An effect that needs services, such as an HTTP client or a repository, gets them from a **runtime** built from a `Layer`. See [Services and runtimes](/services).
