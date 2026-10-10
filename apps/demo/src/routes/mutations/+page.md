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
  import apiSource from "./api.ts?highlight";
  import todosSource from "./todos.ts?highlight";
  import Modes from "./modes.svelte";
  import modesSource from "./modes.svelte?highlight";
  import Optimistic from "./optimistic.svelte";
  import optimisticSource from "./optimistic.svelte?highlight";
</script>

An async atom runs its effect when something reads it. A **mutation** runs its effect when you write to it, such as saving a form or deleting a row. Its state is an `AsyncResult`, so a component can show that a save is in progress, what it returned, or why it failed.

This form saves a todo with a pretend save that takes a second. Under the form, the mutation's type lists what a call can end with: a todo or a `TitleTooLong` error. The side the last call ended on lights up, and a badge beside it shows the mutation's state:

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

## Waiting for the result

The `mode` option decides what calling the setter gives back. Below, one slow mutation is called three ways, one per column, and each column lists what its calls gave back. The mutation's own state, with Cancel and Reset, is underneath:

<Example files={[{ html: modesSource, name: "modes.svelte" }]} hint="Click Call in each column: save(n) returns at once, the two promises wait a second and a half. Click Call twice: the second call interrupts the first, and both promises settle with the second call's result. Then turn on Fail the save and call again."> <div data-testid="modes-example"><Modes /></div> </Example>

| `mode` | The setter returns |
| --- | --- |
| `"value"` (default) | Nothing. Read the atom to see how the call goes. |
| `"promise"` | A promise of the value. It rejects with the error if the effect fails. |
| `"promiseExit"` | A promise of the `Exit`, the effect's success or its failure with a [`Cause`](/effect-basics#exit-and-cause), which never rejects. |

A form that clears itself only when the save succeeds, as the example at the top does, awaits `"promiseExit"` and finds the typed error in the `Exit`'s cause: [Mutations: promise and promiseExit](/errors#mutations-promise-and-promiseexit) on the Errors page shows how.

The promise settles with the mutation's next result. If a second call interrupts the first, both promises settle with the second call's result: click **Call twice** in a promise column and both lines resolve with the second draft.

Pass `{ concurrent: true }` as `Atom.fn`'s second argument, and a new call doesn't interrupt the one in flight: both run to the end.

<Aside type="caution" title="Concurrent calls share one result">

A concurrent mutation still has one result. Each call starts straight away, but the result after it waits until every call still running has finished, and is the result of the oldest of them. So when two calls overlap, both promises settle with the first call's result, and the second call's own result is never seen. A call made once the others have finished gets its own.

</Aside>

To stop waiting, pass an `AbortSignal` as the setter's second argument, `save(todo, { signal })`. Aborting stops the wait, not the call: the promise settles as interrupted, but the call keeps running while something else holds the mutation, such as the component's own `useAtomSet` while it is mounted, or `Atom.keepAlive`. If nothing does, the registry disposes of the mutation and interrupts the call. A signal that is already aborted settles the promise the same way without starting the call, as `fetch` does. To stop the call itself, write `Atom.Interrupt`, below.

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

Reset with a `"value"` setter. After a reset the state is `Initial`, which a promise would wait on forever, so the promise modes don't accept `Atom.Reset`: TypeScript rejects it, and if a call gets past the types, its promise rejects.

## Refreshing what changed

After a mutation changes data on the server, any atom that read that data is out of date. **Reactivity keys** connect the two. Tag the query with keys, and tell the mutation which keys it invalidates. When the mutation succeeds, every atom tagged with one of those keys runs its effect again.

`Atom.withReactivity` tags the query, as in `todos.ts` below. The `reactivityKeys` option belongs to mutations made by a [runtime](/services), so create one with `Atom.runtime`, even if its layer is empty. A failed call invalidates nothing. A mutation can return a `Stream` instead of an effect, and a stream invalidates its keys however it ends, even when it fails or is interrupted.

The diagram under this example follows one request: the mutation runs, succeeds and invalidates the `"todos"` key, and the list, tagged with that key, runs again and brings the new todo. Its requests go to a pretend server in `api.ts`, which takes a moment to answer.

<Example files={[{ html: todosSource, name: "todos.ts" }, { html: refreshTodosSource, name: "refresh-todos.svelte" }, { html: apiSource, name: "api.ts" }]} hint="Click Add: createTodo succeeds, invalidates the todos key, and the list runs again with the new todo. Then click Paste a long title and Add: the call fails, so nothing is invalidated and the list stays as it is."> <div data-testid="refresh-example"><RefreshTodos /><Invalidation /></div> </Example>

## Optimistic updates

A round trip to the server can make the page feel slow. An **optimistic update** shows the result you expect straight away, then replaces it with the real one when the mutation finishes, or rolls it back if the mutation fails. Below, the left column is what the page shows and the right what the server has; the save takes a second and a half.

<Example files={[{ html: optimisticSource, name: "optimistic.svelte" }]} hint="Click a todo's checkbox: it changes on screen at once, marked provisional, while the server still has the old value. Once the save lands, both agree. Then turn on Make the next save fail and click a todo's checkbox again: the save fails, and the screen goes back to what the server has."> <div data-testid="optimistic-example"><Optimistic /></div> </Example>

`Atom.optimistic` wraps the atom to update, and `Atom.optimisticFn` wraps the mutation with a `reducer` that computes the provisional value from the current value and the mutation's argument. Read the optimistic atom instead of the original, and call the wrapped mutation instead of the original one.

While the mutation runs, the optimistic atom holds the reducer's value, marked `waiting`. When the mutation succeeds, the optimistic atom refreshes the original atom, so the mutation needs no `reactivityKeys` for it. When it fails, it goes back to the original atom's value, and the wrapped mutation's state is the `Failure`, so you can say what happened.

The example fails on purpose without sending anything: its mutation checks a flag before it calls the pretend server. A real failure, such as a lost connection, rolls back the same way. It reads the same `todosAtom` as the example above, so a todo you added there shows up here.

## Mutations from RPC and HTTP APIs

`AtomRpc` and `AtomHttpApi` generate mutations from the API's definition. They are ordinary mutations: an RPC client's `mutation("createTodo")` is a `runtime.fn` on the client's [runtime](/services), whose argument is `{ payload }` and whose call sends one `createTodo` request. Its error type is the procedure's errors, such as `TitleTooLong`, plus the client's own. Their queries take `reactivityKeys` as an option, and their mutations take them with each call. See [RPC](/rpc#mutations) and [HTTP API](/http#mutations).
