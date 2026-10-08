# Proposal: an inspector for Effect's `AtomRegistry`

Status: draft, not filed upstream. Written against `effect` 4.0.1 (`effect/reactivity`).

## Summary

Add `registry.inspect(observer)` to `AtomRegistry`: a synchronous, multicast way to hear what a registry does to its nodes. It would report nodes added and removed, each computation and why it ran, each value and where it came from, listeners coming and going, and what a computation started being torn down, including whether an effect was interrupted. A registry nobody inspects would pay one `undefined` check per event.

With it, developer tools could be built on Effect's public API. Without it, effect-atom-svelte's inspector (`packages/effect-atom-svelte/src/internal/nodeInternals.ts`) wraps four members of the registry's private node implementation on every node, and has to infer two of the facts it reports.

## Motivation

A devtools panel for atoms needs to answer three questions: which atoms are alive and what reads what, what each one holds, and why something ran again or was interrupted. Today the public registry answers the first, partly:

| Need | Public API in 4.0.1 | What effect-atom-svelte does instead |
| --- | --- | --- |
| Nodes added and removed | `onNodeAdded`, `onNodeRemoved` | Uses them, but they are a single slot each, so a second tool replaces the first's handler. It chains them by hand. |
| What reads what | `Node.parents`, `Node.children` | Uses them. |
| Readers | `Node.listeners`, a `Set` to read | Puts its own `Set` subclass on each node's `listeners` field to hear adds and deletes. |
| A value changed | none (`subscribe` would add a listener, which keeps the atom alive and makes a lazy atom compute) | Turns `NodeImpl._value` into an accessor on each node. |
| A computation started and ended | none | Wraps `NodeImpl.build` on each node. |
| Why it computed | none | Infers it: marks a node when `registry.refresh` is called for it, and marks a node's children when the node's value changes. Anything else is reported as "invalidated", so `refreshSelf` and a reactivity key look alike, and a window-focus or other refresh signal, which calls `registry.refresh`, looks like a refresh the app asked for. |
| What it started was torn down | none | Turns `NodeImpl.lifetime` into an accessor, and counts `lifetime.finalizers` when it is cleared. |
| An effect was interrupted | none | Infers it: a teardown with finalizers while the value is a waiting `AsyncResult`. An uninterruptible effect, or a stream between elements, is reported wrongly. |
| A write came from outside | none | Replaces `registry.set`, `update` and `modify` on the instance to count writes in progress. |
| The registry's default idle TTL | none | Reads `RegistryImpl.defaultIdleTTL`. |

Each of these breaks silently when the implementation changes, which is why effect-atom-svelte's peer range for `effect` is `~4.0.0`. Any other binding (`@effect/atom-react`, a Vue or Solid adapter) that wanted devtools would have to repeat the same work against the same internals.

The prototype that preceded the panel polled `getNodes()` every 150 ms and read `listeners`, `_value` and `state` directly. It missed everything that happened between polls: a refetch that started and was interrupted inside one interval left no trace.

## Proposal

### API

```ts
// effect/reactivity/AtomRegistry.ts

export interface AtomRegistry {
  // ...existing members

  /**
   * Calls the observer's methods as the registry works, until the returned function is called.
   * Methods run synchronously, in the middle of the registry's work: they must not read or write
   * atoms. Any number of observers may be added.
   */
  readonly inspect: (observer: Observer) => () => void;
}

export interface Observer {
  readonly onNodeAdded?: (node: Node<any>) => void;
  readonly onNodeRemoved?: (node: Node<any>) => void;
  /** The node is about to run its atom's `read`. */
  readonly onBuild?: (node: Node<any>, cause: BuildCause) => void;
  /** The `read` returned or threw. */
  readonly onBuildEnd?: (node: Node<any>, exit: "success" | "failure") => void;
  /** The node's value changed (not called when `equals` says the new one is the same). */
  readonly onValue?: (node: Node<any>, update: ValueUpdate) => void;
  /** A listener was added or removed. */
  readonly onListeners?: (node: Node<any>, count: number) => void;
  /** What the node's last computation started is being torn down. */
  readonly onDispose?: (node: Node<any>, disposal: Disposal) => void;
}

export type BuildCause =
  | { readonly _tag: "Initial" }
  | { readonly _tag: "Parent"; readonly parents: ReadonlyArray<Node<any>> }
  | { readonly _tag: "Refresh" } // registry.refresh, or an atom's own `refresh` passing it on
  | { readonly _tag: "RefreshSelf" } // get.refreshSelf / ctx.refreshSelf
  | { readonly _tag: "Superseded" }; // a running build read a parent that changed

export interface ValueUpdate {
  readonly previous: Option.Option<unknown>;
  readonly value: unknown;
  readonly source:
    | "build" // the read returned it
    | "setSelf" // get.setSelf, such as an effect or stream settling later
    | "write" // registry.set / update / modify, through the atom's `write`
    | "initialValue"; // initialValues, setInitialValue or a preloaded serializable value
}

export interface Disposal {
  readonly reason: "rebuild" | "removed" | "reset";
  readonly finalizers: number;
  /** A fiber the computation forked was still running and was interrupted. */
  readonly interrupted: boolean;
}

export interface Node<A> {
  // ...existing members

  /** How long the node is kept once nothing reads it, in ms, after the registry's default. */
  readonly idleTTL: number | undefined;
}
```

A `Stream` of events can be built on top for tools that want one, but the primitive should be synchronous: a stream schedules, so an observer would see events after the registry has moved on, and could no longer tell what was true at the time (a node's `listeners` when it was removed, the value a teardown interrupted).

### Where each event comes from

Every one of these is a line or two in `AtomRegistry.ts`, behind `if (this.registry.observers !== undefined)`:

- `onNodeAdded`, `onNodeRemoved`: where `onNodeAdded?.()` and `onNodeRemoved?.()` are called now. The existing properties can stay as a single-slot shorthand, or be deprecated in favour of `inspect`.
- `onBuild`, `onBuildEnd`: around `this.atom.read(lifetime)` in `NodeImpl.build`.
- The build cause: `invalidate()` gains a cause argument. `invalidateChildren` passes `{ _tag: "Parent", parents: [this] }`, `refresh` passes `Refresh`, `refreshSelf` passes `RefreshSelf`, and the in-build path passes `Superseded`. The node keeps the cause until its next build; parents that change before then are added to it, which batching makes common.
- `onValue`: in `setValue` after the `equals` check, and in `setInitialValue`. The source is known at each call site: `build` calls `setValue` itself, `WriteContextImpl.setSelf` is a write, `LifetimeProto.setSelf` is `setSelf`.
- `onListeners`: in `NodeImpl.subscribe` and its returned function.
- `onDispose`: in `disposeLifetime`, before the finalizers run, and in `remove` and `reset` with their reasons.
- `interrupted`: `runCallbackSync`'s `cancel` knows whether the fiber was still running when it interrupted it. `makeEffect` can record that on the lifetime, for `disposeLifetime` to report. This replaces a guess with a fact, and gets uninterruptible effects right.

### Cost

A registry with no observers checks one field per event, as `onNodeAdded?.()` does today. Observers are called synchronously with objects the registry already has; only `BuildCause` and `ValueUpdate` allocate, and only when someone is listening.

## Labels

Devtools also need names. `Atom.withLabel` returns a copy of the atom, so labelling an atom after it is made (as a build plugin does) changes its identity: anything that captured the original, such as a derived atom's `read` closure, still holds the unlabelled one. effect-atom-svelte's Vite plugin writes `atom.label` in place instead, which works because atoms aren't frozen. A supported way would help:

- `Atom.setLabel(atom, name, stack?)`, documented as mutating, for tools only; or
- a module-level `WeakMap` that `withLabel` writes and `label` reads, so labelling never copies.

`Atom.serializable` also uses its key as the label when there is none, which is useful, but means a tool can't tell a key from a name the developer chose. A separate `Atom.labelSource` (`"user" | "key"`), or leaving the key out of `label` since `[SerializableTypeId].key` already holds it, would let tools show both.

## What effect-atom-svelte would do with it

`inspect()` in `effect-atom-svelte/inspector` would call `registry.inspect` when it exists and fall back to `nodeInternals.ts` when it doesn't, keeping its own event types. Everything in the table above under "What effect-atom-svelte does instead" would go, along with the two inferences, and the `~4.0.0` peer range could widen once nothing else relies on internals.

## Alternatives considered

- **Only widen the `Node` interface** (`_value` as `value` that doesn't compute, `state`, a listener count). That makes polling safe, but polling misses everything between polls, which is what developers most want to see: a request that started and was cancelled.
- **Make `onNodeAdded` and friends multicast and add a few more single slots.** Smaller, but the cause of a build and whether a fiber was interrupted would still have to be inferred, and every new event would be another property on the registry.
- **An Effect `Tracer` span per build.** Fits Effect's observability story, and could be offered on top of `inspect`, but spans are heavier, asynchronous to export, and don't model "this node's value is now X" or listener counts.

## Open questions

- Should `inspect` exist in production builds? The cost is one check per event, which seems acceptable, and production inspection (logging every refresh of a slow query, say) is a real use. Tree-shaking can't remove it either way, since it is a method.
- Should observers see nodes that existed before `inspect` was called? A `replay: true` option that calls `onNodeAdded` for each current node would save every tool from walking `getNodes()` itself.
- Does `Superseded` need to be distinct from `Parent`? It is a parent change, but one that interrupted a build in progress, which is worth seeing when debugging a request that keeps restarting.
- Should `onListeners` tell apart listeners added by components (`registry.subscribe` from outside) from those atoms add for each other (`get.subscribe`, `get.mount`)? A devtools "readers" count is clearer when it counts only the former.
