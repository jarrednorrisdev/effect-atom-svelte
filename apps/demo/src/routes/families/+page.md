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

Say you're building a todo app, and each todo needs its own piece of state. With one todo, you'd write one atom:

```ts
const todoAtom = Atom.make({ done: false });
```

But you don't have one todo. You have as many as the user creates, and you don't know their ids while you're writing the code. You can't write an atom for each one by hand.

A **family** is the fix. Instead of an atom, you write a function that takes an id and returns an atom for it:

```ts
const todoAtom = Atom.family((id: number) => Atom.make({ done: false, id }));

todoAtom(1); // the atom for todo 1
todoAtom(2); // the atom for todo 2
```

The family remembers the atoms it has made. The first time you call `todoAtom(1)`, it creates todo 1's atom. Every call after that returns that same atom. So if a list and a details panel both call `todoAtom(1)`, they share one piece of state: tick the todo in one place and it's ticked in the other.

The value you pass in (here, the id) is called the **key**. It can be any value that identifies the thing: an id, a search query, a document name.

Try it below. The family makes one counter per fruit, so the fruit's name is the key. Pick a fruit and count: only that fruit's total changes, because each fruit has its own atom.

<Example files={[{ html: source, name: "tallies.svelte" }]}> <Tallies /> </Example>

## New keys make new atoms

You never register keys with a family or create their atoms yourself. The function you pass to `Atom.family` is a recipe: the family runs it the first time it sees a key, and keeps the atom it returns.

So when the user adds a new todo, there's nothing to set up. Call the family with the new id, and the atom exists from then on:

**Example** (A todo the family hasn't seen yet)

```ts
import { Atom } from "effect/reactivity";

const todoAtom = Atom.family((id: number) => {
  console.log(`creating the atom for todo ${id}`);
  return Atom.make({ done: false, id });
});

todoAtom(3); // logs "creating the atom for todo 3"
todoAtom(3); // logs nothing: todo 3 already has its atom

todoAtom(3) === todoAtom(3); // true, the same atom
todoAtom(3) === todoAtom(4); // false, todo 4 gets its own
```

The recipe receives the key, so each new atom can start from a value based on it. Here every todo's atom starts with its own `id`.

### Which keys count as the same

Keys are compared with Effect's structural equality, so objects and arrays with the same contents give the same atom:

```ts
const draftAtom = Atom.family(
  (key: { readonly doc: number; readonly lang: string }) => Atom.make("")
);

draftAtom({ doc: 1, lang: "en" }) === draftAtom({ doc: 1, lang: "en" }); // true
```

A family holds its atoms through weak references, where the platform supports them, so an atom nothing refers to any more can be garbage collected. If that happens, the next call with that key runs the recipe again and makes a fresh atom.

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

When `fruit` changes, `tally` reads and writes the new fruit's atom, and unsubscribes from the old one.

If you pass `tallyAtom(fruit)` directly instead of a function, the hook reads the atom for `fruit`'s value at the time the component was created, and never moves.

## Keeping a family's atoms

A family's atoms follow the usual [lifetimes](/lifetimes): once nothing reads one, the registry disposes of its value. In the example above, every count stays because the list at the bottom reads all three. A component that reads only the selected atom would see the other counts start again from zero.

To keep each value, give the atom an idle TTL inside the family, or wrap it in `Atom.keepAlive`:

**Example** (Counts that outlive their readers)

```ts
const tallyAtom = Atom.family((fruit: string) =>
  Atom.make(0).pipe(Atom.setIdleTTL("5 minutes"))
);
```

<Aside type="caution" title="keepAlive in a family">

A family creates an atom per key. Combined with `keepAlive`, every key you have ever read stays in the registry. Prefer an idle TTL when the keys are unbounded, such as search terms or ids.

</Aside>
