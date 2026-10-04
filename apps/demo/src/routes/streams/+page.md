---
title: Streams
description: Follow a Stream's latest value, or pull its items when you want them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Clock from "./clock.svelte";
  import clockSource from "./clock.svelte?highlight";
  import Countdown from "./countdown.svelte";
  import countdownSource from "./countdown.svelte?highlight";
  import secondsSource from "./seconds.svelte?highlight";
  import Fruit from "./fruit.svelte";
  import fruitSource from "./fruit.svelte?highlight";
</script>

Some values change over time without anyone asking: a clock, a price feed, messages arriving on a socket. An atom backed by an Effect `Stream` follows the stream and always holds its latest value. A **pull atom** works the other way round: it reads the stream only when you ask, which suits paginated data.

## Stream atoms

Pass `Atom.make` a `Stream` and the atom holds the latest item the stream emitted:

<Example files={[{ html: secondsSource, name: "seconds.svelte" }, { html: clockSource, name: "clock.svelte" }]} hint="Each second the stream emits, and the atom holds the latest item. Click Stop reading, wait, then Start reading: the stream starts again from 0."> <Clock /> </Example>

The value is an `AsyncResult`, as with [async atoms](/async-atoms):

- `Initial` until the first item arrives.
- `Success` with the latest item, and `waiting` set while the stream is still running.
- `Success` without `waiting` once the stream ends, or `Failure` if it fails. A stream that ends without emitting anything fails with `NoSuchElementError`, unless the atom still has an item from an earlier run, which it then keeps as a `Success`.

A failure keeps the last item as its previous success, so `AsyncResult.getOrElse` still gives it. The example below counts down from 3 and then finishes in one of the three ways.

<Example files={[{ html: countdownSource, name: "countdown.svelte" }]} hint="Watch the countdown end: the result stops waiting and keeps 1. Then pick Fails, and Emits nothing, and compare the cause and the history."> <Countdown /> </Example>

The stream starts when something first reads the atom, and stops when the last reader goes away.

<Aside type="tip" title="Keep browser-only streams off the server">

When a page renders on the server, every atom it reads starts and keeps running until the render ends. A clock or a socket has nothing useful to show there. Wrap the atom in `Atom.withServerValueInitial`: it is `Initial` on the server and the stream never starts. In the browser it runs as normal.

</Aside>

## Pull atoms

A stream hands over its items in **chunks**: groups of items that are ready at the same time. `Atom.pull` reads the first chunk straight away, and the next chunk each time you write to the atom. Once the first chunk arrives, the atom's value is a `Success` whose `value` has two fields:

- `items`: every item pulled so far.
- `done`: whether the stream has ended.

<Example files={[{ html: fruitSource, name: "fruit.svelte" }]} hint="Click Load more until the button says No more fruit, and watch the pulls: each brings a page of three, and the last brings nothing but done."> <Fruit /> </Example>

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

So a pull takes a chunk, not one item. `Stream.paginate` emits each page as a chunk, so here each pull loads one page of three. When a stream's source sends items faster than you pull, a chunk can hold several, as with a [streaming RPC](/rpc#streaming-procedures) over HTTP.

<Aside type="note" title="The end shows up one pull late">

A pull atom finds out that a stream has ended only when it pulls and nothing comes back. After the last page, `done` is still `false`. The next pull adds no items and sets `done` to `true`, which is when the example's button changes to **No more fruit**.

</Aside>

To keep only the latest chunk in `items` instead of every item so far, pass `{ disableAccumulation: true }` as `Atom.pull`'s second argument.
