---
title: Reading and writing
description: Read atoms with useAtomValue, write them with useAtomSet, or do both with useAtom.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import ReadingAndWriting from "./reading-and-writing.svelte";
  import source from "./reading-and-writing.svelte?highlight";
</script>

Three hooks cover reading and writing. Choose by what the component does with the atom:

| Hook                 | Use it to                            |
| -------------------- | ------------------------------------ |
| `useAtomValue(atom)` | Read an atom's value.                |
| `useAtom(atom)`      | Read and write a writable atom.      |
| `useAtomSet(atom)`   | Write to an atom without reading it. |

The other hooks belong to later topics, such as `useAtomResult` in [Suspense](/suspense) and `useAtomMount` in [Lifetimes](/lifetimes). [Hooks](/reference/Hooks) in the API reference lists them all, including `useAtomSubscribe` and `useAtomInitialValues`.

<Example files={[{ html: source, name: "reading-and-writing.svelte" }]}> <ReadingAndWriting /> </Example>

## Reading

`useAtomValue` returns an object with a read-only `current` property. Read `current` wherever Svelte tracks reactivity, such as markup, `$derived` or `$effect`, and it updates when the atom changes:

```svelte
<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  const count = useAtomValue(countAtom);
  const label = $derived(`${count.current} items`);
</script>

<p>{label}</p>
```

The hook only subscribes while something reads `current`. When nothing does, it unsubscribes, and the registry can dispose of the atom.

### Transforming the value

Pass a function as the second argument to read a value computed from the atom:

```ts
const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
```

The transform runs for this hook only. To share a computed value between components, make a derived atom instead: see [Derived atom or transform?](/derived-atoms#derived-atom-or-transform).

## Reading and writing

`useAtom` takes a writable atom and returns an object whose `current` you can also assign. Assigning writes to the atom, and every reader updates:

```svelte
<button onclick={() => (count.current += 1)}>{count.current}</button>
```

Because `current` is assignable, `bind:` works too:

```svelte
<script lang="ts">
  const name = useAtom(nameAtom);
</script>

<input bind:value={name.current} />
```

## Writing

`useAtomSet` returns a setter. Call it with a new value, or with a function that receives the current value and returns the next one:

```ts
const setCount = useAtomSet(countAtom);

setCount(0);
setCount((n) => n * 10);
```

The component doesn't read the atom, so it doesn't update when the value changes. It does keep the atom mounted for as long as the component lives, so a value you set is not disposed before something reads it.

<Aside type="tip" title="Setters that return a promise">

For atoms that run an effect, such as `Atom.fn`, `useAtomSet` can also return a promise of the result. See [Mutations](/mutations).

</Aside>

## Following a different atom

Every hook that takes an atom also accepts a **getter**: a function that returns an atom. The hook follows whichever atom the function returns, and moves to another when reactive state the function reads changes:

```svelte
<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const draftAtom = Atom.make("");
  const savedAtom = Atom.make("");
</script>

<script lang="ts">
  let showSaved = $state(false);
  const text = useAtomValue(() => (showSaved ? savedAtom : draftAtom));
</script>
```

Passing `showSaved ? savedAtom : draftAtom` directly, without the function, would pick an atom once, when the component is created. [Families](/families) build on getters to give each key its own atom.

<Aside type="note" title="When updates arrive">

A write from an event handler updates every reader at once, so after `count.current += 1`, reading another atom derived from `count` gives the new value. A change that happens while Svelte is evaluating markup or a `$derived`, such as an atom computed for the first time by that read, reaches the hooks on a microtask instead, because Svelte doesn't allow state to change during that evaluation.

</Aside>
