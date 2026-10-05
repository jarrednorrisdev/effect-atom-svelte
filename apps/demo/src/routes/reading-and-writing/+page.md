---
title: Reading and writing
description: Read atoms with useAtomValue, write them with useAtomSet, or do both with useAtom.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Autosave from "./autosave.svelte";
  import autosaveSource from "./autosave.svelte?highlight";
  import Follow from "./follow.svelte";
  import followSource from "./follow.svelte?highlight";
  import ReadingAndWriting from "./reading-and-writing.svelte";
  import source from "./reading-and-writing.svelte?highlight";
</script>

Three hooks cover reading and writing. Choose by what the component does with the atom:

| Hook                 | Use it to                            |
| -------------------- | ------------------------------------ |
| `useAtomValue(atom)` | Read an atom's value.                |
| `useAtom(atom)`      | Read and write a writable atom.      |
| `useAtomSet(atom)`   | Write to an atom without reading it. |

The other hooks belong to later topics, such as `useAtomResult` in [Suspense](/suspense) and `useAtomMount` in [Lifetimes](/lifetimes). [Hooks](/reference/Hooks) in the API reference lists them all, including `useAtomInitialValues`.

<Example files={[{ html: source, name: "reading-and-writing.svelte" }]} hint="Click + or ×10 and watch both values that read countAtom change. Then type a name: bind:value writes nameAtom as you type."> <ReadingAndWriting /> </Example>

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

The hook only subscribes while something reactive reads `current`. When nothing does, it unsubscribes, and the registry can dispose of the atom. Reading `current` only in an event handler gets the value at that moment but doesn't subscribe, so it doesn't hold the atom either: if nothing else holds it, the next read may start from the atom's initial value.

### Transforming the value

Pass a function as the second argument to read a value computed from the atom:

```ts
const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
```

The transform runs for this hook only, and runs again every time `current` is read. If it is expensive, read the plain value and compute in a `$derived`, which runs only when the value changes. To share a computed value between components, make a derived atom instead: see [Derived atom or transform?](/derived-atoms#derived-atom-or-transform).

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

Because a function is treated as an update, storing a function in an atom takes one more wrapper: `setHandler(() => handler)`.

The component doesn't read the atom, so it doesn't update when the value changes. It does keep the atom mounted for as long as the component lives, so a value you set is not disposed before something reads it.

<Aside type="tip" title="Setters that return a promise">

For atoms that run an effect, such as `Atom.fn`, `useAtomSet` can also return a promise of the result. See [Mutations](/mutations).

</Aside>

## Running code on every change

`useAtomSubscribe` calls a function each time the atom's value changes, for as long as the component lives. Use it for side effects, such as saving a draft or sending an analytics event, rather than for showing the value:

```ts
useAtomSubscribe(draftAtom, (draft) => localStorage.setItem("draft", draft));
```

The function isn't called for the value the atom already has, only for changes. Pass `{ immediate: true }` to also call it once with the current value when the component mounts. Like `useAtomSet`, it keeps the atom mounted while the component lives, and it computes the atom, so a derived or async atom that nothing else reads still runs.

The function may write `$state`. A change that comes while another component is reading an atom, when Svelte forbids writing state, reaches the function on a microtask instead.

<Example files={[{ html: autosaveSource, name: "autosave.svelte" }]} hint="Type a note: every keystroke is a change, so every keystroke is saved. The first entry came from immediate, when the example mounted."> <Autosave /> </Example>

## Following a different atom

Every hook that takes an atom also accepts a **getter**: a function that returns an atom. The hook follows whichever atom the function returns, and moves to another when reactive state the function reads changes:

```svelte
<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Kept alive, so each keeps its text while the hook follows the other.
  const draftAtom = Atom.make("").pipe(Atom.keepAlive);
  const savedAtom = Atom.make("").pipe(Atom.keepAlive);
</script>

<script lang="ts">
  let followed = $state<"draft" | "saved">("draft");
  const text = useAtom(() => (followed === "saved" ? savedAtom : draftAtom));
</script>

<input bind:value={text.current} />
```

<Example files={[{ html: followSource, name: "follow.svelte" }]} hint="Type in the box: it writes draftAtom. Then pick savedAtom and type again: the same hook now reads and writes savedAtom, and draftAtom keeps what you typed."> <Follow /> </Example>

When the hook moves to another atom, it lets go of the old one, and the registry disposes of it if nothing else holds it. The snippet keeps both with `Atom.keepAlive`; in the live example, the boxes on the right read both atoms, which holds them too. See [Lifetimes](/lifetimes).

Passing `followed === "saved" ? savedAtom : draftAtom` directly, without the function, would pick an atom once, when the component is created. [Families](/families) build on getters to give each key its own atom.

<Aside type="note" title="When updates arrive">

A write from an event handler updates every reader at once, so after `count.current += 1`, reading another atom derived from `count` gives the new value. A change that happens while Svelte is evaluating markup or a `$derived`, such as an atom computed for the first time by that read, reaches the hooks on a microtask instead, because Svelte doesn't allow state to change during that evaluation.

</Aside>
