---
title: Lifetimes
description: When an atom's value is kept, when it is disposed, and how to clean up after it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Lifetimes from "./lifetimes.svelte";
  import lifetimesSource from "./lifetimes.svelte?highlight";
  import Reader from "./reader.svelte";
  import readerSource from "./reader.svelte?highlight";
</script>

A registry keeps an atom's value only while something needs it. When nothing does, it disposes of the value, stops any effect or stream the atom was running, and runs its finalizers. This keeps memory and open connections in check without you releasing anything by hand. It also means an atom nobody is reading forgets its value, unless you ask the registry to keep it.

Tick a box to mount a component that reads that atom, and untick it to unmount the component. Watch the log:

<Example files={[{ html: lifetimesSource, name: "lifetimes.svelte" }, { html: readerSource, name: "reader.svelte" }]}> <Lifetimes /> </Example>

## Mounted atoms

An atom is **mounted** while something holds it. Each of these holds an atom:

- A hook whose `current` is being read in markup, `$derived` or `$effect`.
- `useAtomSet`, `useAtomRefresh` and `useAtomMount`, for as long as their component lives.
- Another mounted atom that reads it with `get`.
- A promise from a `"promise"` or `"promiseExit"` setter, until it settles.

When the last of them lets go, the registry disposes of the atom on its next sweep, a moment later. The next read starts from scratch: a writable atom goes back to its initial value, and an async atom runs its effect again.

<Aside type="note" title="On the server">

While a page renders on the server, the hooks hold every atom they read until the render ends. Then the request's registry is disposed, and every atom in it with it.

</Aside>

## Keeping atoms alive

Choose how long an atom outlives its readers:

| To keep it | Use |
| --- | --- |
| For as long as the registry lives | `Atom.keepAlive(atom)` |
| For a while after the last reader goes | `Atom.setIdleTTL(atom, "5 minutes")` |
| For a while, for every atom in the registry | `defaultIdleTTL` on `RegistryProvider` |
| For as long as a component lives, without reading it | `useAtomMount(atom)` in that component |

**Example** (A cache that survives navigation)

```ts
import { Atom } from "effect/reactivity";

const settingsAtom = Atom.make(loadSettings).pipe(Atom.keepAlive);

const searchAtom = Atom.family((term: string) =>
  Atom.make(search(term)).pipe(Atom.setIdleTTL("1 minute"))
);
```

Here the settings load once per registry, which is once per session in the browser. Each search result is kept for a minute after you navigate away, so going back shows it straight away.

<Aside type="caution" title="keepAlive in a family">

A family creates an atom per key. Combined with `keepAlive`, every key you have ever read stays in the registry. Prefer an idle TTL when the keys are unbounded, such as search terms or ids.

</Aside>

## Finalizers

To release something when an atom's value is thrown away, register a finalizer with `get.addFinalizer` in the read function:

**Example** (Stopping an interval)

```ts
const nowAtom = Atom.make((get) => {
  const interval = setInterval(() => get.setSelf(Date.now()), 1000);
  get.addFinalizer(() => clearInterval(interval));
  return Date.now();
});
```

Finalizers run when the atom is disposed, and also before it computes again because something it read changed. Each computation cleans up after itself.

### Scoped effects

An async atom's effect runs in a `Scope` with the same lifetime, so anything the effect acquires with `Effect.acquireRelease` or `Effect.addFinalizer` is released at the same moments:

**Example** (A connection that closes with the atom)

```ts
import { Effect } from "effect";
import { Atom } from "effect/reactivity";

const feedAtom = Atom.make(
  Effect.gen(function* () {
    const socket = yield* Effect.acquireRelease(openSocket, (socket) =>
      Effect.sync(() => socket.close())
    );
    return yield* readFirstMessage(socket);
  })
);
```
