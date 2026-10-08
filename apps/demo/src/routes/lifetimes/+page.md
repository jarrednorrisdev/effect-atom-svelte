---
title: Lifetimes
description: When an atom's value is kept, when it is disposed, and how to clean up after it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import chatPageSource from "./chat-page.svelte?highlight";
  import KeepMounted from "./keep-mounted.svelte";
  import keepMountedSource from "./keep-mounted.svelte?highlight";
  import keepMessagesSource from "./keep-messages.svelte?highlight";
  import Lifetimes from "./lifetimes.svelte";
  import lifetimesSource from "./lifetimes.svelte?highlight";
  import Reader from "./reader.svelte";
  import readerSource from "./reader.svelte?highlight";
  import chatSource from "./chat.ts?highlight";
  import Finalizers from "./finalizers.svelte";
  import finalizersSource from "./finalizers.svelte?highlight";
</script>

A registry keeps an atom's value only while something needs it. When nothing does, it disposes of the value and runs the atom's finalizers. This keeps memory, timers and open connections in check without you releasing anything by hand. It also means an atom nobody is reading forgets its value, unless you ask the registry to keep it.

Each box below is an atom, with the number of `<Reader>` components reading it in its corner. **+ Reader** mounts one more and **− Reader** unmounts one:

<Example files={[{ html: lifetimesSource, name: "lifetimes.svelte" }, { html: readerSource, name: "reader.svelte" }]} hint="Add two readers to plain, then remove them one at a time: plain is disposed only when its count reaches 0. Keeping atoms alive, below, explains the other two."> <Lifetimes /> </Example>

## Held atoms

An atom is [held](/reading-and-writing#reading) while something tells the registry its value is still needed. Each of these holds an atom:

- A hook whose `current` is being read in markup, `$derived` or `$effect`.
- `useAtomSet`, `useAtomMount`, `useAtomRefresh`, `useAtomSubscribe`, `useAtomInitialValues` and `useAtomResult`, for as long as their component lives.
- Another atom that reads it with `get`, while that atom is itself held or kept alive.

When the last of them stops holding it, the registry disposes of the atom once the current task ends, so code in the same event handler still sees its value. After that, the next read starts from scratch: a writable atom goes back to its initial value, and a derived atom computes again. A mutation's [promise](/mutations#waiting-for-the-result) also holds its atom until it settles.

<Aside type="note" title="On the server">

While a page renders on the server, the hooks hold every atom they read until the render ends. Then the registry the provider created for the request is disposed, and every atom in it with it. A registry you pass to the provider yourself is yours to dispose of. See [Server rendering](/server-rendering#one-registry-per-request).

</Aside>

## Keeping atoms alive

Choose how long an atom outlives its readers:

| To keep it | Use |
| --- | --- |
| For as long as the registry lives | `atom.pipe(Atom.keepAlive)` |
| For a while after the last reader goes | `atom.pipe(Atom.setIdleTTL("5 minutes"))` |
| For a while, for every atom in the registry | `defaultIdleTTL` on `RegistryProvider`, in milliseconds |
| For as long as a component is mounted, even if nothing reads it | `useAtomMount(atom)` in that component: see [Holding an atom from a component](#holding-an-atom-from-a-component) |

**Example** (State that survives navigation)

```ts
import { Atom } from "effect/reactivity";

const sidebarOpenAtom = Atom.make(true).pipe(Atom.keepAlive);

const draftAtom = Atom.make("").pipe(Atom.setIdleTTL("1 minute"));
```

Here the sidebar keeps its state for as long as the registry lives, which is the whole session in the browser. The draft is kept for a minute after the last component that shows it goes away, so navigating away and straight back keeps what you typed. The live example at the top of the page shows both.

An idle TTL is not exact. The registry groups disposals into time buckets of `timeoutResolution` milliseconds, a `RegistryProvider` option that defaults to 1000, or to half of `defaultIdleTTL` when that is set. An atom can stay up to about two buckets past its TTL.

### Holding an atom from a component

`useAtomMount(atom)` keeps an atom alive for as long as the component that calls it is mounted, even when no component reads the atom. Call it in a component that outlives the readers, such as a layout, and the atom keeps its value while the pages that read it come and go.

**Example** (Keeping a chat's messages while the visitor moves between pages)

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { useAtomMount } from "effect-atom-svelte";
  import { messagesAtom } from "$lib/chat";

  // Held until the layout unmounts, whichever page is open.
  useAtomMount(messagesAtom);
</script>
```

The component is one holder among others. Once it unmounts, the atom is disposed as soon as nothing else holds it, just as when its last reader goes. Holding an atom that hasn't been computed also computes it: a derived atom runs its function, and an atom built from an `Effect` starts it, though nothing reads the result.

In the live example, a tiny app has a layout and two pages, and only the chat page reads `messagesAtom`. The panel beside the app shows what holds the atom at each moment:

<Example files={[{ html: keepMountedSource, name: "keep-mounted.svelte" }, { html: chatSource, name: "chat.ts" }, { html: chatPageSource, name: "chat-page.svelte" }, { html: keepMessagesSource, name: "keep-messages.svelte" }]} hint="Open Chat and send a message or two. Go to Inbox: nothing holds messagesAtom any more, so the registry disposes of it and the messages are gone. Turn on useAtomMount(messagesAtom) in the layout bar, send some more, and switch pages again: the layout still holds it, so they stay."> <KeepMounted /> </Example>

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

Finalizers run when the atom is disposed, and also before it computes again because something it read changed. Each computation cleans up after itself.

In the live example, `tickCountAtom` starts a timer each time it computes, and its finalizer stops it. It reads `tickIntervalAtom`, so changing the interval makes it compute again, and hiding the clock disposes of it. Every timer it has started is listed beside the clock. Turn the finalizer off to see what it prevents:

<Example files={[{ html: finalizersSource, name: "finalizers.svelte" }, { html: readerSource, name: "reader.svelte" }]} hint="Show the clock, click 0.25 s, then hide the clock: each time, the finalizer stops the old timer. Turn off Clear in a finalizer and do it again: the old timers keep ticking. Reset stops them."> <Finalizers /> </Example>

An atom that runs an `Effect` releases what its effect acquired at the same moments. See [Releasing resources](/async-atoms#releasing-resources).
