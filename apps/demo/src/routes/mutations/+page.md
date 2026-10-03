---
title: Mutations
description: Run an Effect when the user does something, and refresh what it changed.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Echo from "./echo.svelte";
  import echoSource from "./echo.svelte?highlight";
  import Notes from "./notes.svelte";
  import notesSource from "./notes.svelte?highlight";
</script>

An async atom runs its effect when something reads it. A **mutation** runs its effect when you write to it, such as saving a form or deleting a row. Its state is an `AsyncResult`, so a component can show that a save is in progress, and what it returned.

<Example files={[{ html: echoSource, name: "echo.svelte" }]}> <Echo /> </Example>

## Creating a mutation

`Atom.fn` takes a function from an argument to an `Effect`, and returns a writable atom:

**Example** (A mutation that saves a todo)

```ts
import { Atom } from "effect/reactivity";

const saveAtom = Atom.fn((todo: Todo) => saveTodo(todo));
```

Writing an argument to the atom runs the effect. Reading the atom gives its `AsyncResult`: `Initial` before the first call, then `waiting` while a call runs, then `Success` or `Failure`.

If you write again while a call is still running, the new call interrupts the old one. Pass `{ concurrent: true }` as `Atom.fn`'s second argument to let calls run side by side.

## Calling it from a component

`useAtomSet` returns a function that calls the mutation, and `useAtomValue` reads its state:

```svelte
<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const save = useAtomSet(saveAtom);
  const saving = useAtomValue(saveAtom);
</script>

<button disabled={saving.current.waiting} onclick={() => save(todo)}>Save</button>
```

`useAtomSet` keeps the mutation mounted for as long as the component lives, so its result is still there when you read it.

### Waiting for the result

By default the setter returns nothing. Pass a `mode` to get a promise of the result instead:

| `mode` | The setter returns |
| --- | --- |
| `"value"` (default) | Nothing. |
| `"promise"` | A promise of the value. It rejects with the error if the effect fails. |
| `"promiseExit"` | A promise of the `Exit`, which never rejects. |

**Example** (Closing a dialog once the save succeeds)

```ts
const save = useAtomSet(saveAtom, { mode: "promise" });

const submit = async () => {
  await save(todo);
  open = false;
};
```

The promise settles with the mutation's next result. If a second call interrupts the first, both promises settle with the second call's result. In the live example above, click both buttons within a second: both lines end with `SECOND`.

To stop waiting, pass an `AbortSignal` as the setter's second argument, `save(todo, { signal })`. Aborting settles the promise as interrupted, but the mutation itself keeps running.

<Aside type="caution" title="Use a promise mode for writes that must finish">

With `"promise"` or `"promiseExit"`, a mutation still running when its component is destroyed runs to the end, because the promise keeps the atom alive. With the default mode nothing does, so the registry disposes of the atom and interrupts the call. Navigating away mid-save then abandons the save.

</Aside>

### Resetting and interrupting

Write `Atom.Reset` to a mutation to put it back to `Initial`, and `Atom.Interrupt` to interrupt the call in flight:

```ts
const setSave = useAtomSet(saveAtom);

setSave(Atom.Reset);
setSave(Atom.Interrupt);
```

## Refreshing what changed

After a mutation changes data on the server, any atom that read that data is out of date. **Reactivity keys** connect the two. Tag the query with keys, and tell the mutation which keys it invalidates. When the mutation finishes, every atom tagged with one of those keys runs its effect again.

<Example files={[{ html: notesSource, name: "notes.svelte" }]}> <Notes /> </Example>

**Example** (Reading the list again after adding to it)

```ts
import { Layer } from "effect";
import { Atom } from "effect/reactivity";

const notesAtom = Atom.make(loadNotes).pipe(Atom.withReactivity(["notes"]));

const runtime = Atom.runtime(Layer.empty);

const addAtom = runtime.fn((note: string) => saveNote(note), {
  reactivityKeys: ["notes"],
});
```

The `reactivityKeys` option belongs to atoms made by a runtime, so create one with `Atom.runtime`, even if its layer is empty. `AtomRpc` and `AtomHttpApi` queries and mutations take `reactivityKeys` too: see [RPC](/rpc).

## Optimistic updates

A round trip to the server can make the page feel slow. An **optimistic update** shows the result you expect straight away, then replaces it with the real one when the mutation finishes, or rolls it back if the mutation fails.

`Atom.optimistic` wraps the atom to update, and `Atom.optimisticFn` wraps the mutation with a `reducer` that computes the provisional value from the current value and the mutation's argument:

**Example** (Showing a new note before it is saved)

```ts
import { AsyncResult, Atom } from "effect/reactivity";

const optimisticNotesAtom = Atom.optimistic(notesAtom);

const addOptimisticAtom = optimisticNotesAtom.pipe(
  Atom.optimisticFn({
    fn: addAtom,
    reducer: (current, note: string) =>
      current.pipe(AsyncResult.map((notes) => [...notes, note])),
  })
);
```

Read `optimisticNotesAtom` instead of `notesAtom`, and call `addOptimisticAtom` instead of `addAtom`. When the mutation succeeds, the optimistic atom reads `notesAtom` again. In the live example, the note shows `(saving…)` until then.
