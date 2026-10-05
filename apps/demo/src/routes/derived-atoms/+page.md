---
title: Derived atoms
description: Compute an atom's value from other atoms, and write back through it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import SharedOrNot from "./shared-or-not.svelte";
  import sharedSource from "./shared-or-not.svelte?highlight";
  import Temperature from "./temperature.svelte";
  import source from "./temperature.svelte?highlight";
</script>

A derived atom computes its value from other atoms. The registry tracks which atoms it reads and computes it again when any of them change, so it never goes stale and you never update it by hand.

<Example files={[{ html: source, name: "temperature.svelte" }]} hint="Step celsiusAtom: both atoms derived from it follow. Then step fahrenheitAtom: it holds no value of its own, so the write converts to °C and sets celsiusAtom."> <Temperature /> </Example>

## Creating a derived atom

Pass `Atom.make` a function instead of a value. The function receives `get`, which reads another atom and records it as a dependency:

**Example** (Doubling a count)

```ts
import { Atom } from "effect/reactivity";

const countAtom = Atom.make(0);
const doubledAtom = Atom.make((get) => get(countAtom) * 2);
```

Read it like any other atom, with `useAtomValue`. A derived atom made this way is read-only, so `useAtom` and `useAtomSet` don't accept it.

While a derived atom is held, the registry computes it once and shares the result with every reader. It runs the function again only after a dependency changes. Once nothing holds it, it is disposed like any other atom, and the next read computes it again: see [Lifetimes](/lifetimes).

Dependencies are recorded again on every run, so a `get` inside a condition counts only while that branch runs. To read an atom without depending on it, use `get.once(atom)`. For atoms that run an `Effect`, `get.result(atom)` waits for another async atom's value: see [Dependent queries](/cookbook#dependent-queries).

<Aside type="tip" title="Shorthand for one dependency">

`countAtom.pipe(Atom.map((n) => n * 2))` computes the same value. When the source is writable, so is the mapped atom: writing to it writes the source.

</Aside>

## Derived atom or transform?

`useAtomValue` also takes a transform, `useAtomValue(countAtom, (n) => n * 2)`. The two differ in where the result lives:

- A **transform** runs inside one hook, for one component. Use it to format a value for display.
- A **derived atom** lives in the registry, and every component reads the same result. Use it when more than one component needs the value, or when computing it is expensive.

Below, two readers use `doubledAtom` and two hooks use a transform. The corner of each box counts how many times its function has run:

<Example files={[{ html: sharedSource, name: "shared-or-not.svelte" }]} hint="Click Add one to countAtom and watch the counters: doubledAtom runs once per change for both of its readers, the transform once in each hook."> <SharedOrNot /> </Example>

## Writable derived atoms

`Atom.writable` takes a read function and a write function. The write function receives a context and the value written, and usually passes the write on to the atoms it reads from:

**Example** (Fahrenheit as a view of Celsius)

```ts
const celsiusAtom = Atom.make(20);

const fahrenheitAtom = Atom.writable(
  (get) => (get(celsiusAtom) * 9) / 5 + 32,
  (ctx, fahrenheit: number) => ctx.set(celsiusAtom, ((fahrenheit - 32) * 5) / 9)
);
```

Only `celsiusAtom` holds a value. Writing to `fahrenheitAtom` writes to `celsiusAtom`, and `fahrenheitAtom` then computes again from it. In the live example above, both steppers are bound to their hook's `current` with `bind:`, so each press is a write, and they stay in step whichever one you step. Stepping °F leaves °C with a fraction, which the example shows to one decimal place.

## When readers are notified

When a derived atom computes again, the registry compares the new value with the old one, and notifies readers only if they differ. Writes are compared the same way. The comparison is `Object.is`, so a function that returns a new array or object notifies every time, even when its contents are the same.

`Atom.withEquality` sets the comparison. `Equal.equals` from `effect` compares arrays and plain objects by their contents:

**Example** (Notifying only when the list of ids changes)

```ts
import { Equal } from "effect";
import { Atom } from "effect/reactivity";

const openIdsAtom = Atom.make((get) =>
  get(todosAtom)
    .filter((todo) => !todo.done)
    .map((todo) => todo.id)
).pipe(Atom.withEquality(Equal.equals));
```

Renaming a todo changes `todosAtom`, so `openIdsAtom` computes again, but its readers aren't notified, because the ids are the same. `withEquality` also takes your own function, `(a, b) => boolean`.
