---
title: Mutations
description: Run an Effect when the user does something, and refresh what it changed.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import AddTodo from "./add-todo.svelte";
  import addTodoSource from "./add-todo.svelte?highlight";
  import Invalidation from "./invalidation.svelte";
  import Modes from "./modes.svelte";
  import modesSource from "./modes.svelte?highlight";
  import Optimistic from "./optimistic.svelte";
  import optimisticSource from "./optimistic.svelte?highlight";
</script>

An async atom runs its effect when something reads it. A **mutation** runs its effect when you write to it, such as saving a form or deleting a row. Its state is an `AsyncResult`, so a component can show that a save is in progress, what it returned, or why it failed.

This form adds a todo to the demo server over [RPC](/rpc). The diagram under it follows one request: the mutation runs, succeeds and invalidates the `"todos"` key, and the list, tagged with that key, runs again and brings the new todo.

<Example files={[{ html: addTodoSource, name: "add-todo.svelte" }]} hint="Click Add: the button waits, then the new todo arrives in the list. Then click Paste a long title and Add again."> <div data-testid="add-example"><AddTodo /><Invalidation /></div> </Example>

## Creating a mutation

`Atom.fn` takes a function from an argument to an `Effect`, and returns a writable atom:

**Example** (A mutation that saves a todo)

```ts
import { Atom } from "effect/reactivity";

const saveAtom = Atom.fn((todo: Todo) => saveTodo(todo));
```

Writing an argument to the atom runs the effect. Reading the atom gives its `AsyncResult`: `Initial` before the first call, then `waiting` while a call runs, then `Success` or `Failure`.

If you write again while a call is still running, the new call interrupts the old one. Pass `{ concurrent: true }` as `Atom.fn`'s second argument to let calls run side by side.

`AtomRpc` and `AtomHttpApi` make mutations for you. The example's `TodosRpc.mutation("createTodo")` is an `Atom.fn` that sends one `createTodo` request per write, with the payload as its argument.

## Calling it from a component

`useAtomSet` returns a function that calls the mutation, and `useAtomValue` reads its state. The example disables its button while `waiting` is true:

```svelte
<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const save = useAtomSet(saveAtom);
  const saving = useAtomValue(saveAtom);
</script>

<button disabled={saving.current.waiting} onclick={() => save(todo)}>Save</button>
```

`useAtomSet` keeps the mutation mounted for as long as the component lives, so its result is still there when you read it.

## Showing a typed failure

A form wants to know how its save ended, so it can clear itself or say what went wrong. With `mode: "promiseExit"` the setter returns a promise of the call's `Exit`, which never rejects. The demo server fails `createTodo` with a typed `TitleTooLong` error when the title is over 60 characters, and the example finds it in the `Cause`:

**Example** (Keeping the input when the save fails)

```ts
const create = useAtomSet(createAtom, { mode: "promiseExit" });

const submit = async () => {
  const exit = await create({ payload: { title } });
  if (Exit.isSuccess(exit)) {
    title = "";
    return;
  }
  const failure = Cause.findErrorOption(exit.cause);
  // failure.value is TitleTooLong | RpcClientError, so checking _tag narrows it.
};
```

Only success clears `title`, so after a failure the form still holds what the reader typed. The mutation's own state is a `Failure` too, which the badge next to the button shows.

## Waiting for the result

The `mode` option decides what calling the setter gives back. Each button below calls the same slow mutation with a different mode, and the log shows what each call gave back:

<Example files={[{ html: modesSource, name: "modes.svelte" }]} hint="Click each Save button. Then turn on Fail the save and click them again, or click Cancel during a save."> <div data-testid="modes-example"><Modes /></div> </Example>

| `mode` | The setter returns |
| --- | --- |
| `"value"` (default) | Nothing. Read the atom to see how the call goes. |
| `"promise"` | A promise of the value. It rejects with the error if the effect fails. |
| `"promiseExit"` | A promise of the `Exit`, which never rejects. |

The promise settles with the mutation's next result. If a second call interrupts the first, both promises settle with the second call's result: click **Save (promise)** twice within a second and both lines resolve with the second draft.

To stop waiting, pass an `AbortSignal` as the setter's second argument, `save(todo, { signal })`. Aborting settles the promise as interrupted, but the mutation itself keeps running.

<Aside type="caution" title="Use a promise mode for writes that must finish">

With `"promise"` or `"promiseExit"`, a mutation still running when its component is destroyed runs to the end, because the promise keeps the atom alive. With the default mode nothing does, so the registry disposes of the atom and interrupts the call. Navigating away mid-save then abandons the save.

</Aside>

### Cancelling and resetting

Write `Atom.Interrupt` to a mutation to interrupt the call in flight, and `Atom.Reset` to put it back to `Initial`:

```ts
const setSave = useAtomSet(saveAtom);

setSave(Atom.Interrupt);
setSave(Atom.Reset);
```

After **Cancel**, the mutation's state is a `Failure` whose cause is an interruption, so every promise waiting on it settles as interrupted: `"promise"` rejects, and `"promiseExit"` resolves with a failed `Exit`.

## Refreshing what changed

After a mutation changes data on the server, any atom that read that data is out of date. **Reactivity keys** connect the two. Tag the query with keys, and tell the mutation which keys it invalidates. When the mutation succeeds, every atom tagged with one of those keys runs its effect again. That is the path the diagram under the first example draws.

**Example** (Reading the list again after adding to it)

```ts
const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
const createAtom = TodosRpc.mutation("createTodo");

// In the component: this call invalidates "todos" when it succeeds.
create({ payload: { title }, reactivityKeys: ["todos"] });
```

A failed call invalidates nothing: add a title that is too long, and the list stays as it is. Every atom on the page tagged `"todos"` runs again, including the list in the next example.

Outside `AtomRpc` and `AtomHttpApi`, tag an atom with `Atom.withReactivity`, and pass `reactivityKeys` to a mutation made by a [runtime](/services):

```ts
import { Layer } from "effect";
import { Atom } from "effect/reactivity";

const notesAtom = Atom.make(loadNotes).pipe(Atom.withReactivity(["notes"]));

const runtime = Atom.runtime(Layer.empty);

const addAtom = runtime.fn((note: string) => saveNote(note), {
  reactivityKeys: ["notes"],
});
```

The `reactivityKeys` option belongs to atoms made by a runtime, so create one with `Atom.runtime`, even if its layer is empty.

## Optimistic updates

A round trip to the server can make the page feel slow. An **optimistic update** shows the result you expect straight away, then replaces it with the real one when the mutation finishes, or rolls it back if the mutation fails.

<Example files={[{ html: optimisticSource, name: "optimistic.svelte" }]} hint="Tick a todo: it changes at once. Then turn on Make the next save fail and tick a todo again: a second later it goes back."> <div data-testid="optimistic-example"><Optimistic /></div> </Example>

`Atom.optimistic` wraps the atom to update, and `Atom.optimisticFn` wraps the mutation with a `reducer` that computes the provisional value from the current value and the mutation's argument. Read the optimistic atom instead of the original, and call the wrapped mutation instead of the original one.

While the mutation runs, the optimistic atom holds the reducer's value, marked `waiting`. When the mutation succeeds, the optimistic atom reads the original atom again. When it fails, it goes back to the original atom's value, and the wrapped mutation's state is the `Failure`, so you can say what happened.

The example fails on purpose without sending anything: its mutation is a `TodosRpc.runtime.fn` that checks a flag before it calls the server. A real failure, such as a lost connection, rolls back the same way.

<Aside type="tip" title="All of it in one form">

The Cookbook's [form with typed errors and an optimistic update](/cookbook#a-form-with-typed-errors-and-an-optimistic-update) puts these pieces together: an optimistic add, the `TitleTooLong` message, and the rollback when the save fails.

</Aside>
