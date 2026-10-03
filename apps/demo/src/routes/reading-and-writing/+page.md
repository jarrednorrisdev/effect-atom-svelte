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

The hook only subscribes while something reads `current`. When nothing does, it lets go of the atom and the registry can dispose of it.

### Transforming the value

Pass a function as the second argument to read a value computed from the atom:

```ts
const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
```

The transform runs for this hook only. To share a computed value between components, make a [derived atom](/derived-atoms) instead.

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

<Aside type="tip">

For atoms that run an effect, such as `Atom.fn`, `useAtomSet` can also return a promise of the result. See [Mutations](/mutations).

</Aside>

## Following a different atom

Every hook accepts a function that returns an atom, as well as an atom. The hook then follows whichever atom the function returns, and switches when reactive state it reads changes:

```ts
let id = $state(1);
const todo = useAtomValue(() => todoAtom(id));
```

This is how you read from a [family](/families) of atoms.
