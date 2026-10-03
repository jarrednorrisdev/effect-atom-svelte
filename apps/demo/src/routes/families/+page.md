---
title: Families
description: Create one atom per key, and follow the one your component needs.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Tallies from "./tallies.svelte";
  import source from "./tallies.svelte?highlight";
</script>

Some state comes in many copies: a todo per id, a page of results per query, a draft per document. A **family** is a function from a key to an atom. It creates the atom for a key the first time you ask for it, and returns that same atom every time after.

<Example files={[{ html: source, name: "tallies.svelte" }]}> <Tallies /> </Example>

## Creating a family

Wrap a function that builds an atom in `Atom.family`:

**Example** (A todo atom per id)

```ts
import { Atom } from "effect/reactivity";

const todoAtom = Atom.family((id: number) => Atom.make({ done: false, id }));

todoAtom(1) === todoAtom(1); // true
todoAtom(1) === todoAtom(2); // false
```

Keys are compared with Effect's structural equality, so objects and arrays with the same contents give the same atom:

```ts
const draftAtom = Atom.family(
  (key: { readonly doc: number; readonly lang: string }) => Atom.make("")
);

draftAtom({ doc: 1, lang: "en" }) === draftAtom({ doc: 1, lang: "en" }); // true
```

A family holds its atoms through weak references, where the platform supports them, so an atom nothing refers to any more can be garbage collected.

## Reading from a family

Pass a hook a function that calls the family. The hook follows whichever atom the function returns, and moves to a new atom when the reactive state it reads changes:

**Example** (Following the selected key)

```svelte
<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  let fruit = $state("apples");
  const tally = useAtom(() => tallyAtom(fruit));
</script>
```

When `fruit` changes, `tally` reads and writes the new fruit's atom, and lets go of the old one.

If you pass `tallyAtom(fruit)` directly instead of a function, the hook reads the atom for `fruit`'s value at the time the component was created, and never moves.

<Aside type="caution" title="Atoms you move away from can be reset">

Once nothing reads an atom, the registry disposes of its value. In the example above, every count stays because the list at the bottom reads all three. A component that reads only the selected atom would see the other counts start again from zero. To keep each value, wrap the atom in `Atom.keepAlive` inside the family, or give it an idle TTL. See [Lifetimes](/lifetimes).

</Aside>
