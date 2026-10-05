---
title: Streams
description: Follow a Stream's latest value, or pull its items when you want them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Clock from "./clock.svelte";
  import clockSource from "./clock.svelte?highlight";
  import clockAtomSource from "./clock.ts?highlight";
  import Countdown from "./countdown.svelte";
  import countdownSource from "./countdown.svelte?highlight";
  import readerSource from "./reader.svelte?highlight";
  import Fruit from "./fruit.svelte";
  import fruitSource from "./fruit.svelte?highlight";
</script>

Some values change over time without anyone asking: a clock, a price feed, messages arriving on a socket. An atom backed by an Effect `Stream` follows the stream and always holds its latest value. A **pull atom** works the other way round: it reads the stream only when you ask, which suits paginated data.

## Stream atoms

Pass `Atom.make` a `Stream` and the atom holds the latest item the stream emitted. The stream starts when something first reads the atom, and every reader shares it. It stops when the last reader goes away:

<Example files={[{ html: clockAtomSource, name: "clock.ts" }, { html: clockSource, name: "clock.svelte" }, { html: readerSource, name: "reader.svelte" }]} hint="Turn on Reader B: it shows the same count, from the same stream. Turn off Reader A: the stream keeps running for B. Turn off B as well, and the log shows the stream stopped. Read again, and a new stream counts from 1."> <Clock /> </Example>

The value is an `AsyncResult`, as with [async atoms](/async-atoms):

- `Initial` until the first item arrives.
- `Success` with the latest item, and `waiting` set while the stream is still running.
- `Success` without `waiting` once the stream ends, or `Failure` if it fails. A stream that ends without emitting anything fails with `NoSuchElementError`, unless the atom still has an item from an earlier run, as after a refresh: then it keeps that item.

A failure keeps the last item as its previous success, so `AsyncResult.getOrElse` still gives it. The example below counts down from 3 and then finishes in one of the three ways.

<Example files={[{ html: countdownSource, name: "countdown.svelte" }]} hint="Watch the countdown end: the result stops waiting and keeps 1. Then pick Fails: the stream fails after 1, and the atom still gives 1. Pick Emits nothing, and there is no item to keep."> <Countdown /> </Example>

<Aside type="tip" title="Keep browser-only streams off the server">

When a page renders on the server, every atom it reads starts and keeps running until the render ends. A clock or a socket has nothing useful to show there. Wrap the atom in `Atom.withServerValueInitial`: it is `Initial` on the server and the stream never starts. [Server values](/server-rendering#server-values) explains how the server reads such an atom. In the browser it runs as normal. A serializable stream atom left on the server sends its latest item with the page, and the browser runs the stream again: see [How the result travels](/hydration#how-the-result-travels).

</Aside>

A stream that needs services, such as a socket client, gets them from a [runtime](/services): `runtime.atom(stream)` makes a stream atom, and `runtime.pull(stream)` a pull atom.

## Pull atoms

A stream hands over its items in **chunks**: groups of items that are ready at the same time. `Atom.pull` reads the first chunk straight away, and the next chunk each time you write to the atom. Once the first chunk arrives, the atom's value is a `Success` whose `value` has two fields:

- `items`: every item pulled so far.
- `done`: whether the stream has ended.

While a pull runs, the result is that same `Success` with `waiting` set, so the items pulled so far stay on screen.

<Example files={[{ html: fruitSource, name: "fruit.svelte" }]} hint="Click Load more until the button says No more fruit: each pull brings one chunk, a page of up to three, and the last brings nothing but done. Then turn on disableAccumulation and load again: items holds only the latest page, and the end arrives as a NoSuchElementError failure instead of done."> <Fruit /> </Example>

**Example** (Loading the next page)

```ts
// In a module
import { Atom } from "effect/reactivity";

const fruitAtom = Atom.pull(fruitStream);

// In a component's script
import { useAtomSet, useAtomValue } from "effect-atom-svelte";

const page = useAtomValue(fruitAtom);
const loadMore = useAtomSet(fruitAtom);

loadMore(); // pulls the next chunk
```

So a pull takes a chunk, not one item. `Stream.paginate` emits each page as a chunk, so here each pull loads one page: three fruit, then three, then the last one. When a stream's source sends items faster than you pull, a chunk can hold several, as with a [streaming RPC](/rpc#streaming-procedures) over HTTP.

<Aside type="note" title="The end shows up one pull late">

A pull atom finds out that a stream has ended only when it pulls and nothing comes back. After the last page, `done` is still `false`. The next pull adds no items and sets `done` to `true`, which is when the example's button changes to **No more fruit**.

</Aside>

Refreshing a pull atom, with `useAtomRefresh`, starts the stream again and pulls its first chunk.

To keep only the latest chunk in `items` instead of every item so far, pass `{ disableAccumulation: true }` as `Atom.pull`'s second argument, as the example's toggle does. The end then shows up differently: the pull that finds it has no items to give, so it fails with `NoSuchElementError` rather than setting `done`, and the atom keeps the last page as its previous success.
