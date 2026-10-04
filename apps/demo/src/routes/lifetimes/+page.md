---
title: Lifetimes
description: When an atom's value is kept, when it is disposed, and how to clean up after it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import chatPanelSource from "./chat-panel.svelte?highlight";
  import KeepMounted from "./keep-mounted.svelte";
  import keepMountedSource from "./keep-mounted.svelte?highlight";
  import Lifetimes from "./lifetimes.svelte";
  import lifetimesSource from "./lifetimes.svelte?highlight";
  import Reader from "./reader.svelte";
  import readerSource from "./reader.svelte?highlight";
</script>

A registry keeps an atom's value only while something needs it. When nothing does, it disposes of the value and runs the atom's finalizers. This keeps memory, timers and open connections in check without you releasing anything by hand. It also means an atom nobody is reading forgets its value, unless you ask the registry to keep it.

Each box below is an atom, with the number of `<Reader>` components reading it in its corner. **+ Reader** mounts one more and **− Reader** unmounts one. The registry computes an atom for its first reader and disposes of it once its last reader has gone, unless the atom is kept alive or has an idle TTL:

<Example files={[{ html: lifetimesSource, name: "lifetimes.svelte" }, { html: readerSource, name: "reader.svelte" }]} hint="Add two readers to plain, then remove them one at a time: plain is disposed only when its count reaches 0. Then do the same with keepAlive and idle TTL."> <Lifetimes /> </Example>

## Mounted atoms

An atom is **mounted** while something holds it. Each of these holds an atom:

- A hook whose `current` is being read in markup, `$derived` or `$effect`.
- `useAtomSet` and `useAtomMount`, for as long as their component lives.
- Another mounted atom that reads it with `get`.

When the last of them stops holding it, the registry disposes of the atom shortly afterwards. The next read starts from scratch: a writable atom goes back to its initial value, and a derived atom computes again. Later pages add a few more holders, such as [`useAtomRefresh`](/async-atoms#running-it-again) and a mutation's [promise](/mutations#waiting-for-the-result).

<Aside type="note" title="On the server">

While a page renders on the server, the hooks hold every atom they read until the render ends. Then the request's registry is disposed, and every atom in it with it. See [Server rendering](/server-rendering#one-registry-per-request).

</Aside>

## Keeping atoms alive

Choose how long an atom outlives its readers:

| To keep it | Use |
| --- | --- |
| For as long as the registry lives | `atom.pipe(Atom.keepAlive)` |
| For a while after the last reader goes | `atom.pipe(Atom.setIdleTTL("5 minutes"))` |
| For a while, for every atom in the registry | `defaultIdleTTL` on `RegistryProvider` |
| For as long as a component lives, without reading it | `useAtomMount(atom)` in that component |

**Example** (State that survives navigation)

```ts
import { Atom } from "effect/reactivity";

const sidebarOpenAtom = Atom.make(true).pipe(Atom.keepAlive);

const draftAtom = Atom.make("").pipe(Atom.setIdleTTL("1 minute"));
```

Here the sidebar keeps its state for as long as the registry lives, which is the whole session in the browser. The draft is kept for a minute after the last component that shows it goes away, so navigating away and straight back keeps what you typed.

The live example at the top of the page shows `keepAlive` and an idle TTL. `useAtomMount` is for a component that needs an atom alive without showing it, such as a chat panel that keeps a connection open while it is on screen. Below, `socketAtom` stands in for the connection, and each holder adds one to its count:

<Example files={[{ html: keepMountedSource, name: "keep-mounted.svelte" }, { html: chatPanelSource, name: "chat-panel.svelte" }, { html: readerSource, name: "reader.svelte" }]} hint="Show the panel: the socket opens, though nothing reads it. Show a reader too, then hide the panel: the reader still holds it. Hide both and the socket closes."> <KeepMounted /> </Example>

Atoms that run an `Effect` follow the same rules, so `keepAlive` and an idle TTL also make a cache: see [Async atoms](/async-atoms). For atoms made per key, see [Keeping a family's atoms](/families#keeping-a-familys-atoms).

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

Finalizers run when the atom is disposed, and also before it computes again because something it read changed. Each computation cleans up after itself. The live example above uses one to log `disposed`.

An atom that runs an `Effect` releases what its effect acquired at the same moments. See [Releasing resources](/async-atoms#releasing-resources).
