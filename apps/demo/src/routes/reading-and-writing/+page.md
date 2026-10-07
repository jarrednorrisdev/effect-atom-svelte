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

The other hooks belong to later topics, such as `useAtomResult` in [Suspense](/suspense), `useAtomMount` in [Lifetimes](/lifetimes), and `useAtomInitialValues` in [Starting atoms from request data](/sveltekit#starting-atoms-from-request-data). [Hooks](/reference/Hooks) in the API reference lists them all.

<Example files={[{ html: source, name: "reading-and-writing.svelte" }]} hint="Click +, − or Reset and watch both values that read countAtom change. Then type a name: bind:value writes nameAtom as you type."> <ReadingAndWriting /> </Example>

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

While something reactive reads `current`, the hook **holds** the atom: it tells the registry the value is still needed, and the registry keeps it. When nothing reads `current`, the hook lets go, and once nothing holds the atom, the registry can dispose of its value. [Lifetimes](/lifetimes#held-atoms) lists everything that holds an atom.

Reading `current` only in an event handler gets the value at that moment, but doesn't hold the atom: if nothing else holds it, the next read may start from the atom's initial value.

### Transforming the value

Pass a function as the second argument to read a value computed from the atom:

```ts
const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
```

The transform runs for this hook only, and runs again only when the atom, or state the transform reads, changes, so a transform that builds an object returns the same object until then. A read outside markup or `$derived`, such as in an event handler, runs it again. To share a computed value between components, make a derived atom instead: see [Derived atom or transform?](/derived-atoms#derived-atom-or-transform).

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

The component doesn't read the atom, so it doesn't update when the value changes. It does hold the atom for as long as the component lives, so a value you set is not disposed before something reads it.

<Aside type="tip" title="Setters that return a promise">

For atoms that run an effect, such as `Atom.fn`, `useAtomSet` can also return a promise of the result. See [Mutations](/mutations).

</Aside>

<Aside type="note" title="Writes apply immediately">

A write from an event handler updates every reader at once: the handler's next line already reads the new value, from the atom and from atoms derived from it.

</Aside>

## Following a different atom

Every hook that takes an atom also accepts a **getter**: a function that returns an atom. The hook follows whichever atom the function returns, and moves to another when reactive state the function reads changes:

```svelte
<script lang="ts">
  let followed = $state<"draft" | "saved">("draft");
  // Runs again when followed changes, and the hook moves to the atom it returns.
  const text = useAtom(() => (followed === "saved" ? savedAtom : draftAtom));
</script>
```

<Example files={[{ html: followSource, name: "follow.svelte" }]} hint="Type in the box: it writes draftAtom. Then pick savedAtom and type again: the same hook now reads and writes savedAtom, and draftAtom keeps what you typed."> <Follow /> </Example>

When the hook moves to another atom, it lets go of the old one, and the registry disposes of it if nothing else holds it. The example keeps both with `Atom.keepAlive`. See [Lifetimes](/lifetimes).

Passing `followed === "saved" ? savedAtom : draftAtom` directly, without the function, would pick an atom once, when the component is created. [Families](/families) build on getters to give each key its own atom.

## Running code on every change

`useAtomSubscribe` calls a function each time the atom's value changes, for as long as the component lives. Use it for side effects, such as saving a draft or sending an analytics event, rather than for showing the value:

```ts
useAtomSubscribe(draftAtom, (draft) => localStorage.setItem("draft", draft));
```

The function isn't called for the value the atom already has, only for changes. Pass `{ immediate: true }` to also call it once with the current value when the component mounts. Like `useAtomSet`, it holds the atom while the component lives, and it computes the atom, so a derived or async atom that nothing else reads still runs.

The function may write `$state`. Svelte forbids writing state while it renders, so a change that arrives during a render reaches the function on the next microtask instead.

<Example files={[{ html: autosaveSource, name: "autosave.svelte" }]} hint="Type a note: every keystroke is a change, so every keystroke is saved. The first entry came from immediate, when the example mounted."> <Autosave /> </Example>
