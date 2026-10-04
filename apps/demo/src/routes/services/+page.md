---
title: Services and runtimes
description: Give atoms' effects the services they need, with Atom.runtime and a Layer.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Dice from "./dice.svelte";
  import source from "./dice.svelte?highlight";
  import Pool from "./pool.svelte";
  import poolSource from "./pool.svelte?highlight";
  import poolReaderSource from "./pool-reader.svelte?highlight";
</script>

An effect that needs a service, such as an HTTP client or a repository, says so in its type, and can't run until something provides it. For atoms, that something is a **runtime**: an atom that builds a `Layer` and runs other atoms' effects with its services.

[Effect basics](/effect-basics#services-and-layers) introduces services and layers. The example below uses a `Dice` service with two layers, a fair die and a loaded one. Turn on **Loaded dice** to switch layers.

<Example files={[{ html: source, name: "dice.svelte" }]} hint="Turn on Loaded dice: the runtime builds the other layer, and dieAtom rolls again with it. Then roll a few times."> <Dice /> </Example>

## Making a runtime

`Atom.runtime` takes a layer and returns a runtime. Its methods make atoms whose effects can use the layer's services:

**Example** (An atom backed by a service)

```ts
import { Context, Effect, Layer } from "effect";
import { Atom } from "effect/reactivity";

class Todos extends Context.Service<
  Todos,
  { readonly count: Effect.Effect<number> }
>()("app/Todos") {}

const TodosLayer = Layer.succeed(Todos, { count: Effect.succeed(3) });

const runtime = Atom.runtime(TodosLayer);

const countAtom = runtime.atom(Todos.use((todos) => todos.count));
```

| Method | Makes | Like |
| --- | --- | --- |
| `runtime.atom(effect)` | An async atom. It also takes a function of `get`, or a `Stream`. | [`Atom.make`](/async-atoms) |
| `runtime.fn((arg) => effect)` | A mutation. | [`Atom.fn`](/mutations) |
| `runtime.pull(stream)` | A pull atom. | [`Atom.pull`](/streams#pull-atoms) |

An atom made this way fails with the layer's error if the layer fails to build.

## When the layer is built

The runtime is an atom itself, so it follows the usual [lifetimes](/lifetimes). It builds its layer the first time one of its atoms runs, and every atom made from it shares the services. When none of its atoms is in use any more, the runtime is disposed and the layer's resources are released.

Layers are built once per registry. On the server, each request has its own registry and so its own services. Two runtimes that use the same layer share one copy of it in each registry.

In the live example, the runtime's layer builds a pretend connection pool with `Effect.acquireRelease`, and two atoms made from the runtime say which pool they got.

<Example files={[{ html: poolSource, name: "pool.svelte" }, { html: poolReaderSource, name: "pool-reader.svelte" }]} hint="Turn on Read usersAtom: the runtime builds pool 1. Turn on Read ordersAtom: it shares pool 1. Turn both off: the pool is released. Turn one on again: pool 2 is built."> <Pool /> </Example>

## Choosing a layer with `get`

`Atom.runtime` also takes a function that receives `get` and returns the layer, as in the example above. When an atom it read changes, the runtime builds the new layer, and its atoms run their effects again with the new services.

## Reactivity keys need a runtime

`runtime.fn` takes a `reactivityKeys` option, and `Atom.fn` doesn't, because invalidating keys uses the `Reactivity` service that every runtime provides. That is why [Mutations](/mutations#refreshing-what-changed) makes a runtime with an empty layer:

```ts
const runtime = Atom.runtime(Layer.empty);

const addAtom = runtime.fn((note: string) => saveNote(note), {
  reactivityKeys: ["notes"],
});
```

## Layers for every runtime

`Atom.runtime.addGlobalLayer(layer)` adds a layer to every runtime, such as a logger or tracing for the whole app. Call it once at startup, before any atom runs.

<Aside type="tip" title="Testing">

The runtime keeps its layer in an atom, `runtime.layer`, so a test can give it a different layer through `initialValues`. See [Replacing a runtime's layer](/testing#replacing-a-runtimes-layer).

</Aside>

`AtomRpc` and `AtomHttpApi` clients are services with a runtime of their own, which builds the client's protocol or HTTP client layer. See [RPC](/rpc) and [HTTP API](/http).
