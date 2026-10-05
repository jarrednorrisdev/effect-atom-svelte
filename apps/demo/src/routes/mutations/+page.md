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
  import RefreshTodos from "./refresh-todos.svelte";
  import refreshTodosSource from "./refresh-todos.svelte?highlight";
  import todosSource from "./todos.ts?highlight";
  import Modes from "./modes.svelte";
  import modesSource from "./modes.svelte?highlight";
  import Optimistic from "./optimistic.svelte";
  import optimisticSource from "./optimistic.svelte?highlight";
</script>

An async atom runs its effect when something reads it. A **mutation** runs its effect when you write to it, such as saving a form or deleting a row. Its state is an `AsyncResult`, so a component can show that a save is in progress, what it returned, or why it failed.

This form saves a todo with a pretend save that takes a second. Under it, the mutation's type marks how the last call ended: with its success type or its error type. Its state follows each call:

<Example files={[{ html: addTodoSource, name: "add-todo.svelte" }]} hint="Click Add: the mutation waits, then succeeds with the new todo, and the input clears. Then click Paste a long title and Add again: it fails with TitleTooLong, and the input keeps the title."> <div data-testid="add-example"><AddTodo /></div> </Example>

## Creating a mutation

`Atom.fn` takes a function from an argument to an `Effect`, and returns a writable atom:

**Example** (A mutation that saves a todo)

```ts
import { Atom } from "effect/reactivity";

const saveAtom = Atom.fn((todo: Todo) => saveTodo(todo));
```

Writing an argument to the atom runs the effect. Reading the atom gives its `AsyncResult`: `Initial` before the first call, then `waiting` while a call runs, then `Success` or `Failure`.

If you write again while a call is still running, the new call interrupts the old one.

The function also receives `get`, as its second argument. In a mutation, `get(atom)` reads an atom's current value without subscribing to it, so a change to that atom doesn't run the mutation again. `get.set(atom, value)` writes to an atom, and `get.result(atom)` is an effect that gives an async atom's value once it has one, or fails with its error:

**Example** (Reading another atom when the call starts)

```ts
const saveAtom = Atom.fn((todo: Todo, get) =>
  saveTodo(todo, { draft: get(draftModeAtom) })
);
```

The example under [Waiting for the result](#waiting-for-the-result) reads its **Fail the save** switch this way.

## Calling it from a component

`useAtomSet` returns a function that calls the mutation, and `useAtomValue` reads its state. The example at the top disables its button while `waiting` is true:

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

A form wants to know how its save ended, so it can clear itself or say what went wrong. With `mode: "promiseExit"` the setter returns a promise of the call's `Exit`, which never rejects. The example's save fails with a typed `TitleTooLong` error when the title is over 60 characters. To say what went wrong, find the typed error in the `Cause`:

**Example** (Keeping the input when the save fails)

```ts
const create = useAtomSet(createAtom, { mode: "promiseExit" });

const submit = async () => {
  const exit = await create(title);
  if (Exit.isSuccess(exit)) {
    title = "";
    return;
  }
  const error = Cause.findErrorOption(exit.cause);
  // None when the call was interrupted or died, rather than failing.
  if (Option.isSome(error)) {
    message = `Keep it to ${error.value.maxLength} characters.`;
  }
};
```

With several kinds of error, `error.value` is their union, and checking its `_tag` narrows it.

Only success clears `title`, so after a failure the form still holds what the reader typed. The mutation's own state is a `Failure` too: the example at the top shows its cause rather than reading the `Exit`.

## Waiting for the result

The `mode` option decides what calling the setter gives back. Below, one slow mutation is called three ways, one per column, and each column lists what its calls gave back. The mutation's own state, with Cancel and Reset, is underneath:

<Example files={[{ html: modesSource, name: "modes.svelte" }]} hint="Click Call in each column: save(n) returns at once, the two promises wait a second and a half. Click Call twice: the second call interrupts the first, and both promises settle with the second call's result. Then turn on Fail the save and call again."> <div data-testid="modes-example"><Modes /></div> </Example>

| `mode` | The setter returns |
| --- | --- |
| `"value"` (default) | Nothing. Read the atom to see how the call goes. |
| `"promise"` | A promise of the value. It rejects with the error if the effect fails. |
| `"promiseExit"` | A promise of the `Exit`, the effect's success or its failure with a [`Cause`](/effect-basics#exit-and-cause), which never rejects. |

The promise settles with the mutation's next result. If a second call interrupts the first, both promises settle with the second call's result: click **Call twice** in a promise column and both lines resolve with the second draft.

Pass `{ concurrent: true }` as `Atom.fn`'s second argument, and a new call doesn't interrupt the one in flight: both run to the end.

<Aside type="caution" title="Concurrent calls share one result">

A concurrent mutation still has one result. Each new call waits for every call already running, and the mutation settles with the result of the oldest. So every caller's promise gets the oldest call's result, not its own.

</Aside>

To stop waiting, pass an `AbortSignal` as the setter's second argument, `save(todo, { signal })`. Aborting settles the promise as interrupted. The call keeps running only while something else holds the mutation, such as the component's own `useAtomSet` while it is mounted, or `Atom.keepAlive`. If nothing does, the registry disposes of the mutation and interrupts the call.

<Aside type="caution" title="Use a promise mode for writes that must finish">

With `"promise"` or `"promiseExit"`, a mutation still running when its component is destroyed runs to the end, because the promise keeps the atom alive. With the default mode nothing does, so the registry disposes of the atom and interrupts the call. Navigating away mid-save then abandons the save.

To keep a mutation whatever the mode, make it with `Atom.keepAlive`, as in `Atom.fn(saveTodo).pipe(Atom.keepAlive)`. The registry then never disposes of it, so its calls finish and its last result stays.

</Aside>

### Canceling and resetting

Write `Atom.Interrupt` to a mutation to interrupt the call in flight, and `Atom.Reset` to put it back to `Initial`:

```ts
const setSave = useAtomSet(saveAtom);

setSave(Atom.Interrupt);
setSave(Atom.Reset);
```

After **Cancel**, the mutation's state is a `Failure` whose cause is an interruption, so every promise waiting on it settles as interrupted: `"promise"` rejects, and `"promiseExit"` resolves with a failed `Exit`. Try it in the example above, during a save.

Reset with a `"value"` setter. After a reset the state is `Initial`, which a promise would wait on forever, so the promise modes don't accept `Atom.Reset`: their types leave it out, and the promise rejects.

## Mutations from RPC and HTTP APIs

The rest of this page uses an RPC client, `TodosRpc`, and its queries and mutations. [RPC](/rpc) introduces them; you only need the idea that a query is an async atom and a mutation is an `Atom.fn`.

`AtomRpc` and `AtomHttpApi` generate mutations from the API's definition. They are the same thing, made for you: `TodosRpc.mutation("createTodo")` is a `runtime.fn` on the client's [runtime](/services), whose argument is `{ payload }` and whose call sends one `createTodo` request. Its error type is the procedure's errors, such as `TitleTooLong`, plus the client's own. See [RPC](/rpc#mutations) and [HTTP API](/http#mutations).

The rest of this page uses the demo server's todos over RPC, from `todos.ts`:

<Example files={[{ html: todosSource, name: "todos.ts" }]} />

## Refreshing what changed

After a mutation changes data on the server, any atom that read that data is out of date. **Reactivity keys** connect the two. Tag the query with keys, and tell the mutation which keys it invalidates. When the mutation succeeds, every atom tagged with one of those keys runs its effect again.

The diagram under this example follows one request: the mutation runs, succeeds and invalidates the `"todos"` key, and the list, tagged with that key, runs again and brings the new todo.

<Example files={[{ html: refreshTodosSource, name: "refresh-todos.svelte" }, { html: todosSource, name: "todos.ts" }]} hint="Click Add: createTodo succeeds, invalidates the todos key, and the list runs again with the new todo. Then click Paste a long title and Add: the call fails, so nothing is invalidated and the list stays as it is."> <div data-testid="refresh-example"><RefreshTodos /><Invalidation /></div> </Example>

**Example** (Reading the list again after adding to it)

```ts
const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
const createAtom = TodosRpc.mutation("createTodo");

// In the component: this call invalidates "todos" when it succeeds.
create({ payload: { title }, reactivityKeys: ["todos"] });
```

A failed call invalidates nothing. Every atom on the page tagged `"todos"` runs again, including the lists in the next example.

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

A round trip to the server can make the page feel slow. An **optimistic update** shows the result you expect straight away, then replaces it with the real one when the mutation finishes, or rolls it back if the mutation fails. Below, the left column is what the page shows and the right what the server has; the save takes a second and a half.

<Example files={[{ html: optimisticSource, name: "optimistic.svelte" }]} hint="Tick a todo: it changes on screen at once, marked provisional, while the server still has the old value. Once the save lands, both agree. Then turn on Make the next save fail and tick a todo again: the save fails, and the screen goes back to what the server has."> <div data-testid="optimistic-example"><Optimistic /></div> </Example>

`Atom.optimistic` wraps the atom to update, and `Atom.optimisticFn` wraps the mutation with a `reducer` that computes the provisional value from the current value and the mutation's argument. Read the optimistic atom instead of the original, and call the wrapped mutation instead of the original one.

While the mutation runs, the optimistic atom holds the reducer's value, marked `waiting`. When the mutation succeeds, the optimistic atom refreshes the original atom, so the mutation needs no `reactivityKeys` for it. When it fails, it goes back to the original atom's value, and the wrapped mutation's state is the `Failure`, so you can say what happened.

The example fails on purpose without sending anything: its mutation is a `TodosRpc.runtime.fn` that checks a flag before it calls the server. A real failure, such as a lost connection, rolls back the same way.

<Aside type="tip" title="All of it in one form">

The Cookbook's [form with typed errors and an optimistic update](/cookbook#a-form-with-typed-errors-and-an-optimistic-update) puts these pieces together: an optimistic add, the `TitleTooLong` message, and the rollback when the save fails.

</Aside>
