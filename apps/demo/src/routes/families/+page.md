---
title: Families
description: Create one atom per key, and follow the one your component needs.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import KeptTallies from "./kept-tallies.svelte";
  import keptSource from "./kept-tallies.svelte?highlight";
  import SameKey from "./same-key.svelte";
  import sameKeySource from "./same-key.svelte?highlight";
  import TodoApp from "./todo-app.svelte";
  import appSource from "./todo-app.svelte?highlight";
  import detailsSource from "./todo-details.svelte?highlight";
  import listSource from "./todo-list.svelte?highlight";
  import rowSource from "./todo-row.svelte?highlight";
  import todosSource from "./todos.ts?highlight";
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

Try it below. The list and the details panel are separate components that pass no state between them: each row calls `todoAtom` with its todo's id, and the panel calls it with the id of the todo you opened. When both use the same id, they read the same atom.

<Example files={[{ html: todosSource, name: "todos.ts" }, { html: rowSource, name: "todo-row.svelte" }, { html: detailsSource, name: "todo-details.svelte" }, { html: listSource, name: "todo-list.svelte" }, { html: appSource, name: "todo-app.svelte" }]} hint="Tick Buy milk in the list: the details panel shows it done too, because both read todoAtom(1). Open another todo and mark it done from the panel. Then add a todo: its new id gets a new atom, starting open."> <TodoApp /> </Example>

## New keys make new atoms

You never register keys with a family or create their atoms yourself. The function you pass to `Atom.family` is a recipe: the family runs it the first time it sees a key, and keeps the atom it returns.

So when the user adds a new todo, there's nothing to set up. In the app above, **Add** only pushes a new id onto the list. The new row calls `todoAtom` with it, and the atom exists from then on:

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

Try it below. Every click passes `draftAtom` a new key object, and the family runs its recipe only for contents it hasn't seen:

<Example files={[{ html: sameKeySource, name: "same-key.svelte" }]} hint="Click Call draftAtom twice: the second call returns the same atom. Then change the document or the language and call it again."> <SameKey /> </Example>

A family holds its atoms through weak references, where the platform supports them, so an atom nothing refers to any more can be garbage collected. If that happens, the next call with that key runs the recipe again and makes a fresh atom.

## Reading from a family

A family isn't an atom, so a hook can't read it directly. Instead, pass the hook a function that calls the family with a key. The hook follows whichever atom the function returns, and moves to a new atom when the reactive state it reads changes. This is how the details panel in the app above follows the todo you open:

**Example** (Following the selected key)

```svelte
<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { todoAtom } from "./todos.ts";

  const { id }: { id: number } = $props();
  // The atom for whichever todo is open.
  const todo = useAtom(() => todoAtom(id));
</script>
```

When `id` changes, `todo` reads and writes the new todo's atom, and unsubscribes from the old one.

If you pass `todoAtom(id)` directly instead of a function, the hook reads the atom for `id`'s value at the time the component was created, and never moves: the panel would keep showing the first todo you opened.

## Keeping a family's atoms

A family's atoms follow the usual [lifetimes](/lifetimes): once nothing reads one, the registry disposes of its value. In the todo app, every row reads its todo, so no atom is ever left without a reader. But a component that reads only the selected key holds one atom at a time: pick another key, and the registry disposes of the one you left, so its value starts again from the recipe.

To keep each value, give the atom an idle TTL inside the family, or wrap it in `Atom.keepAlive`:

**Example** (Counts that outlive their readers)

```ts
const tallyAtom = Atom.family((fruit: string) =>
  Atom.make(0).pipe(Atom.setIdleTTL("5 minutes"))
);
```

Below are three families that differ only in how long they keep their atoms. Add one to each, then pick another fruit, and watch which fruits each family still has in the registry:

<Example files={[{ html: keptSource, name: "kept-tallies.svelte" }]} hint="Add one to each family, then pick pears. plain lets go of apples at once, idle TTL four seconds later, and keepAlive never: pick apples again to find its count."> <KeptTallies /> </Example>

<Aside type="caution" title="keepAlive in a family">

A family creates an atom per key. Combined with `keepAlive`, every key you have ever read stays in the registry. Prefer an idle TTL when the keys are unbounded, such as search terms or ids.

</Aside>
