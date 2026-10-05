---
title: Services and runtimes
description: Give atoms' effects the services they need, with Atom.runtime and a Layer.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Dice from "./dice.svelte";
  import diceSource from "./dice.svelte?highlight";
  import Pool from "./pool.svelte";
  import poolSource from "./pool.svelte?highlight";
  import poolReaderSource from "./pool-reader.svelte?highlight";
</script>

An effect that needs a service, such as an HTTP client or a repository, says so in its type, and can't run until something provides it. For atoms, that something is a **runtime**: an atom that builds a `Layer` and runs other atoms' effects with its services.

[Effect basics](/effect-basics#services-and-layers) introduces services and layers. In the example below, a runtime's layer builds a pretend connection pool with `Effect.acquireRelease`, and two atoms made from the runtime say which pool they got.

<Example files={[{ html: poolSource, name: "pool.svelte" }, { html: poolReaderSource, name: "pool-reader.svelte" }]} hint="Turn on Read usersAtom: the runtime builds pool 1. Turn on Read ordersAtom: it shares pool 1. Turn both off: the pool is released. Turn one on again: pool 2 is built."> <Pool /> </Example>

## Making a runtime

`Atom.runtime` takes a layer and returns a runtime. Its methods make atoms whose effects can use the layer's services. With the `Todos` service and `TodosLayer` from [Effect basics](/effect-basics#services-and-layers):

**Example** (An atom backed by a service)

```ts
import { Atom } from "effect/reactivity";

const runtime = Atom.runtime(TodosLayer);

// Effect<number, never, Todos>: the runtime provides Todos.
const countAtom = runtime.atom(Todos.use((todos) => todos.count));
```

| Method | Makes | Like |
| --- | --- | --- |
| `runtime.atom(effect)` | An async atom. It also takes a function of `get`, or a `Stream`. | [`Atom.make`](/async-atoms) |
| `runtime.fn((arg) => effect)` | A mutation. | [`Atom.fn`](/mutations) |
| `runtime.pull(stream)` | A pull atom. | [`Atom.pull`](/streams#pull-atoms) |

An atom made this way fails with the layer's error if the layer fails to build.

Every runtime also provides the `Reactivity` service, which is why `runtime.fn` takes a `reactivityKeys` option and `Atom.fn` doesn't. See [Mutations](/mutations#refreshing-what-changed).

A layer whose service needs another service gets it with `Layer.provide`. Give the runtime the result, and it builds both:

```ts
// RemoteTodosLayer needs an Http service, which HttpLayer builds.
const runtime = Atom.runtime(RemoteTodosLayer.pipe(Layer.provide(HttpLayer)));
```

<Aside type="caution" title="Make runtimes in a module">

Like atoms, runtimes belong in a module, or a component's `<script module>`. `Atom.runtime` called in a component's script makes a new runtime for each instance, and new atoms from it, so each instance runs its effects itself and keeps its own results. The services are still built once per registry, as long as the layer itself comes from a module: see [When the layer is built](#when-the-layer-is-built).

</Aside>

## When the layer is built

The runtime is an atom itself, so it follows the usual [lifetimes](/lifetimes). It builds its layer the first time one of its atoms runs, and every atom made from it shares the services. When none of its atoms is in use any more, the runtime is disposed and the layer's resources are released.

Layers are built once per registry. On the server, each request has its own registry and so its own services. Two runtimes that use the same layer share one copy of it in each registry.

The example at the top shows this: the pool is built when the first atom is read, shared by the second, and released when neither is read.

## Choosing a layer with `get`

`Atom.runtime` also takes a function that receives `get` and returns the layer. When an atom it read changes, the runtime builds the new layer, and its atoms run their effects again with the new services.

The example below uses a `Dice` service with two layers, a fair die and a loaded one. Turn on **Loaded dice** to switch layers.

<Example files={[{ html: diceSource, name: "dice.svelte" }]} hint="Turn on Loaded dice: the runtime builds the other layer, and dieAtom rolls again with it. Then roll a few times."> <Dice /> </Example>

## Layers for every runtime

`Atom.runtime.addGlobalLayer(layer)` adds a layer to every runtime, such as a logger or tracing for the whole app. Call it once at startup, before any runtime builds its layer.

<Aside type="tip" title="Testing">

The runtime keeps its layer in an atom, `runtime.layer`, so a test can give it a different layer through `initialValues`. See [Replacing a runtime's layer](/testing#replacing-a-runtimes-layer).

</Aside>

`AtomRpc` and `AtomHttpApi` clients are services with a runtime of their own, which builds the client's protocol or HTTP client layer. See [RPC](/rpc) and [HTTP API](/http).
