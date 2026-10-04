---
title: Errors
description: Typed errors, defects and interruptions, and every place to handle them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Outcomes from "./outcomes.svelte";
  import outcomesSource from "./outcomes.svelte?highlight";
</script>

A request can fail in ways you expect, such as a missing record, and in ways you don't, such as a bug. Effect keeps the two apart, and the type of an async atom lists every error you expect. This page brings together what the other pages say about failure: what a failure holds, how to tell errors apart, and where to handle them.

<Example files={[{ html: outcomesSource, name: "outcomes.svelte" }]} hint="Pick each outcome. The two typed errors get their own messages from their _tag; a defect and an interruption both reach onDefect, and only the cause tells them apart."> <Outcomes /> </Example>

## Three kinds of failure

An effect can end without a value in three ways:

| Kind | Comes from | In the type? |
| --- | --- | --- |
| **Typed error** | `Effect.fail`, a yielded tagged error, `tryPromise`'s `catch`, an RPC or HTTP API error. | Yes, as the `E` in `Effect<A, E>` and `AsyncResult<A, E>`. |
| **Defect** | An exception thrown inside the effect, or `Effect.die`. Usually a bug. | No. |
| **Interruption** | Something stopped the effect, such as the registry disposing of an atom nobody reads. | No. |

Handle typed errors where they happen, because they are part of what the user can do: a todo can be missing, a title can be too long. Defects and interruptions are rarely something a component can fix, so show a general message and log them. [Effect basics](/effect-basics#cause) introduces these with Effect's own docs.

## What a Failure holds

When an async atom's effect fails, its value is an `AsyncResult` `Failure`. Its `cause` is a `Cause`, which records all three kinds. To get the typed error out:

| Function | Gives |
| --- | --- |
| `Cause.findErrorOption(cause)` | The first typed error, as an `Option`. `None` for a defect or an interruption. |
| `AsyncResult.error(result)` | The same, straight from an `AsyncResult`. |
| `AsyncResult.matchWithError(result, { ... })` | Calls `onError` with the typed error, or `onDefect` with anything else, as in the example above. |
| `Cause.pretty(cause)` | The whole cause as text, with stack traces. Use it for logs. |

A `Failure` also keeps `previousSuccess`, the last value before the failure, so `AsyncResult.getOrElse` can keep showing it. See [Working with AsyncResult](/async-atoms#working-with-asyncresult).

## Matching on `_tag`

A typed error made with `Data.TaggedError` or `Schema.TaggedError` has a `_tag`, so the error type is a union TypeScript can narrow. Check `_tag`, or hand each tag a function with `Match.valueTags`:

**Example** (A message for each error)

```ts
import { Cause, Match, Option } from "effect";

const describe = (cause: Cause.Cause<TodoNotFound | Forbidden>) => {
  const error = Cause.findErrorOption(cause);
  if (Option.isNone(error)) {
    return "Something went wrong.";
  }
  return Match.valueTags(error.value, {
    Forbidden: () => "You can't see this todo.",
    TodoNotFound: (e) => `There is no todo ${e.id}.`,
  });
};
```

`Match.valueTags` needs a function for every tag, so when an effect gains a new error, TypeScript points at each place that doesn't handle it yet. Each function receives the narrowed error, with its fields, such as `id`.

<Aside type="caution" title="Don't parse the cause's text">

`Cause.pretty` and an error's `message` are written for people. Reading the error's name out of them breaks when the wording changes, and loses the error's fields. Match on `_tag` instead.

</Aside>

## Where to handle failure

Each way of reading an atom hands you failure in its own form.

### With `useAtomValue` or `useAtomResult`

Both give you the `AsyncResult`, failures included. Check `_tag` in the markup, as on [Async atoms](/async-atoms#asyncresult), or use the functions above. `await useAtomResult(...)` resolves once the first result is in, whether it succeeded or failed: it doesn't throw.

### In a boundary

`useAtomSuspense` rejects when the atom fails, and the nearest `<svelte:boundary>` renders its `failed` snippet. The promise rejects with `Cause.squash(cause)`: the first typed error if there is one, otherwise the defect, otherwise an `Error` saying the effect was interrupted. See [Handling failure](/suspense#handling-failure).

Before the `failed` snippet sees the error, SvelteKit passes it through its `handleError` hook, as the next section explains.

### In place, with `includeFailure`

To handle typed errors next to the value rather than in a boundary, pass `includeFailure: true` to `useAtomSuspense`. The promise then resolves with the `Success` or `Failure` itself and never rejects:

**Example** (A missing todo, handled in place)

```svelte
<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

  const todo = useAtomSuspense(() => todoAtom(id), { includeFailure: true });
</script>

<svelte:boundary>
  {@const result = await todo.current}
  {#if result._tag === "Success"}
    <p>{result.value.title}</p>
  {:else}
    <p>{describe(result.cause)}</p>
  {/if}
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
```

The lookups on the [RPC](/rpc#following-arguments) and [HTTP API](/http#typed-errors) pages work this way.

### Mutations: `promise` and `promiseExit`

A mutation's setter can return a promise of its result, with `useAtomSet`'s `mode`:

- **`"promise"`** resolves with the value, and rejects with `Cause.squash(cause)` like a boundary does. A `catch` block receives `unknown`, so the error's type is lost.
- **`"promiseExit"`** resolves with an `Exit` and never rejects. `Exit.isSuccess(exit)` tells you which it is, and a failed `Exit` has the `cause`, still typed.

Prefer `"promiseExit"` when the mutation has typed errors to show:

**Example** (Showing a typed error from a form)

```ts
import { Exit } from "effect";
import { useAtomSet } from "effect-atom-svelte";

const create = useAtomSet(createAtom, { mode: "promiseExit" });

const submit = async () => {
  const exit = await create({ payload: { title: draft } });
  error = Exit.isSuccess(exit) ? "" : describe(exit.cause);
};
```

The mutation's own value is an `AsyncResult` too, so `useAtomValue(createAtom)` also shows the last call's failure. See [Mutations](/mutations#waiting-for-the-result).

## SvelteKit's `handleError`

In a SvelteKit app, an error that reaches a boundary's `failed` snippet goes through SvelteKit's `handleError` hook first. The default hook replaces it with `{ message: "Internal Error" }`, so the snippet can't tell one error from another.

`effect-atom-svelte/sveltekit` has hooks that keep the error's `_tag` as `error.tag`. The client hook keeps the message too. The server hook doesn't, because a message from the server can reveal details of it. With them, a `failed` snippet can match on the tag:

```svelte
{#snippet failed(error)}
  {#if (error as App.Error).tag === "TodoNotFound"}
    <p>No such todo.</p>
  {:else}
    <p>Something went wrong.</p>
  {/if}
{/snippet}
```

Only the tag and message survive the hook, not the error's other fields. When you need those, use `includeFailure` instead. [SvelteKit](/sveltekit#errors-in-boundaries) shows how to install the hooks.

## Typed errors from RPC and HTTP APIs

`AtomRpc` and `AtomHttpApi` decode errors from the server with their schemas, so they arrive as the same tagged classes, fields and all:

- **An RPC procedure** fails with the errors in its `error` schema, plus `RpcClientError` when the request itself fails, for example because the server can't be reached.
- **An HTTP API endpoint** fails with the errors it declares. A request that fails, or a response that doesn't decode, is a defect rather than a typed error, so the only typed errors are your own.

Declaring the errors with `Schema.TaggedError` gives them a `_tag` on both sides:

**Example** (An error the server can send)

```ts
import { Schema } from "effect";

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>()(
  "TodoNotFound",
  { id: Schema.Int },
  { httpApiStatus: 404 }
) {}
```

## Recovering inside the effect

Sometimes an error isn't a failure for the page: a missing profile can just mean "no profile yet". Handle it in the effect, before the atom sees it, and it leaves the atom's error type:

**Example** (A missing todo becomes `null`)

```ts
import { Effect } from "effect";
import { Atom } from "effect/reactivity";

const todoAtom = Atom.family((id: number) =>
  Atom.make(
    fetchTodo(id).pipe(
      Effect.catchTag("TodoNotFound", () => Effect.succeed(null))
    )
  )
);
```

`Effect.catchTags` handles several tags at once. Read more about recovering in Effect's [Error Management](https://effect.website/docs/v4/error-management/expected-errors) docs.
