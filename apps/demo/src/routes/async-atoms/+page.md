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

In a script, `AsyncResult.match` does the same with a function for each state.

<Aside type="tip" title="Await instead of checking tags">

With Svelte's experimental async turned on, you can `await` an async atom in markup and let `<svelte:boundary>` handle loading and failure. See [Suspense](/suspense).

</Aside>

## Running it again

`useAtomRefresh` returns a function that runs the atom's effect again:

```ts
const roll = useAtomRefresh(dieAtom);
```

While it runs, the atom keeps its previous result with `waiting` set to `true`, so a refresh doesn't take the value away. The hook also keeps the atom mounted for as long as the component lives, so a refresh is never lost because nothing was reading.

## Using services

An effect that needs services, such as an HTTP client or a repository, gets them from a **runtime**. `Atom.runtime` builds one from a `Layer`, and its `atom` method makes atoms whose effects can use the layer's services:

**Example** (An atom backed by a service)

```ts
import { Context, Effect, Layer } from "effect";
import { Atom } from "effect/reactivity";

class Dice extends Context.Service<
  Dice,
  { readonly roll: Effect.Effect<number> }
>()("Dice") {
  static readonly layer = Layer.succeed(Dice, { roll: Effect.succeed(4) });
}

const runtime = Atom.runtime(Dice.layer);

const dieAtom = runtime.atom(Dice.use((dice) => dice.roll));
```

The runtime builds its layer when one of its atoms first needs it, and every atom made from it shares the same services. Atoms built with `AtomRpc` and `AtomHttpApi` work this way too: see [RPC](/rpc) and [HTTP API](/http).
