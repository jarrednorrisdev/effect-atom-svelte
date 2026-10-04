---
title: Effect basics
description: The parts of Effect these docs use, for Svelte developers who haven't used it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Hash from "./hash.svelte";
  import hashSource from "./hash.svelte?highlight";
  import Request from "./request.svelte";
  import requestSource from "./request.svelte?highlight";
</script>

From here on, atoms run Effects: to fetch data, to save it, to follow a stream. You don't need to know all of Effect to use them. This page covers the parts these docs use, each with a link to [Effect's own documentation](https://effect.website/docs/v4) for the rest.

The example wraps a promise API, the browser's `crypto.subtle.digest`, in an Effect, and reads it through an atom. Pick `MD5`, which Web Crypto doesn't support, to see a typed error.

<Example files={[{ html: hashSource, name: "hash.svelte" }]} hint="Type some text and watch the hash follow it. Then pick MD5: the promise rejects, and the atom fails with a typed error."> <Hash /> </Example>

## The Effect type

An `Effect` is a description of some work, which may be asynchronous and may fail. Its type has three parameters:

```ts
Effect<Success, Error, Requirements>;
```

- `Success` is what the work produces.
- `Error` is how it is expected to fail. `never` means it doesn't.
- `Requirements` are the services it needs before it can run. `never` means none.

Unlike a promise, an effect is lazy. Creating one runs nothing: it runs when something runs it, and it can be run again. In these docs, that something is an atom. An async atom runs its effect when a component first reads it, runs it again when an atom it read changes, and interrupts it when nothing reads it any more.

**Example** (Effects that succeed and fail)

```ts
import { Effect } from "effect";

const two = Effect.succeed(2); // Effect<number, never, never>

const failed = Effect.fail("Not found"); // Effect<never, string, never>

// Effect.gen reads like async/await: yield* takes the value out of an effect.
const sum = Effect.gen(function* () {
  const a = yield* two;
  const b = yield* Effect.succeed(3);
  return a + b;
}); // Effect<number, never, never>
```

Read more in [The Effect Type](https://effect.website/docs/v4/getting-started/the-effect-type) and [Using Generators](https://effect.website/docs/v4/getting-started/using-generators).

## Wrapping a promise

Most code you already have returns promises: `fetch`, an SDK, a database driver. `Effect.tryPromise` turns a function that returns a promise into an effect. `try` is called each time the effect runs, and `catch` turns a rejection into the effect's error:

**Example** (Fetching JSON)

```ts
import { Data, Effect } from "effect";

class FetchFailed extends Data.TaggedError("FetchFailed")<{
  readonly url: string;
}> {}

const getJson = (url: string) =>
  Effect.tryPromise({
    catch: () => new FetchFailed({ url }),
    try: (signal) => fetch(url, { signal }).then((response) => response.json()),
  }); // Effect<any, FetchFailed, never>
```

`try` receives an `AbortSignal`, which Effect aborts if the effect is interrupted. Pass it on, as above, and an atom that nobody reads any more cancels its request.

The example below wraps a pretend slow API that takes an `AbortSignal`, as `fetch` does. Interrupting the effect aborts the signal, and the server's log shows the request being dropped. Its atom is made with `Atom.fn`, which runs the effect each time it's called and stops it when written `Atom.Interrupt`; [Mutations](/mutations) covers it.

<Example files={[{ html: requestSource, name: "request.svelte" }]} hint="Click Send request, then Interrupt before the two seconds are up. Then send another and let it finish."> <Request /> </Example>

Without `catch`, as in `Effect.tryPromise(() => fetch(url))`, a rejection becomes an `UnknownError`. When a promise can't reject, `Effect.promise` wraps it without an error type.

Read more in [Creating Effects](https://effect.website/docs/v4/getting-started/creating-effects).

## Typed errors

An effect's errors are part of its type, so a component can know every way a request can fail. Define each kind of error as a class with `Data.TaggedError`. The string you pass becomes the error's `_tag`, which tells the kinds apart:

**Example** (Two errors, told apart by `_tag`)

```ts
import { Data } from "effect";

class NotFound extends Data.TaggedError("NotFound")<{
  readonly id: number;
}> {}

class Forbidden extends Data.TaggedError("Forbidden") {}

const describe = (error: NotFound | Forbidden) => {
  switch (error._tag) {
    case "NotFound":
      return `There is no todo ${error.id}.`;
    case "Forbidden":
      return "You can't see this todo.";
  }
};
```

Inside `Effect.gen`, `yield*` a tagged error to fail with it: `return yield* new NotFound({ id })`. `Effect.catchTag("NotFound", ...)` recovers from one kind and leaves the others in the type.

Read more in [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors) and [Yieldable Errors](https://effect.website/docs/v4/error-management/yieldable-errors).

## Cause

An effect can fail in three ways, and only the first is in its type:

- **A typed error**, from `Effect.fail`, a yielded tagged error or `tryPromise`'s `catch`.
- **A defect**, an exception nobody expected, such as a bug that throws inside `Effect.gen` or `Effect.sync`, or an `Effect.die`.
- **An interruption**, when something stops the effect before it finishes.

A `Cause` records which of these happened. When an async atom fails, its `AsyncResult` is a `Failure` whose `cause` is a `Cause`, and the example above reads it with two functions:

- `Cause.findErrorOption(cause)` gives the typed error, as an `Option`. It is `None` when the effect died or was interrupted.
- `Cause.pretty(cause)` renders the whole cause as text, for logs and for failures you didn't expect.

[Errors](/errors) covers handling each kind in a component.

Read more in [Cause](https://effect.website/docs/v4/data-types/cause).

## Services and layers

The third type parameter, `Requirements`, lists the services an effect uses: an HTTP client, a repository, a logger. A service is declared with `Context.Service`, and an effect asks for it by yielding it:

**Example** (A service and an effect that uses it)

```ts
import { Context, Effect, Layer } from "effect";

class Todos extends Context.Service<
  Todos,
  { readonly count: Effect.Effect<number> }
>()("app/Todos") {}

const countTodos = Effect.gen(function* () {
  const todos = yield* Todos;
  return yield* todos.count;
}); // Effect<number, never, Todos>

// A layer says how to build the service.
const TodosLive = Layer.succeed(Todos, { count: Effect.succeed(3) });
```

The effect can't run until something provides `Todos`. A **layer** builds services, and can depend on other layers. For atoms, `Atom.runtime(layer)` provides one: see [Services and runtimes](/services). `AtomRpc` and `AtomHttpApi` build their clients as services in the same way.

Read more in [Managing Services](https://effect.website/docs/v4/requirements-management/services) and [Managing Layers](https://effect.website/docs/v4/requirements-management/layers).

## Schema

A `Schema` describes the shape of some data, and checks unknown data against it. It produces a TypeScript type and a decoder from one definition:

**Example** (Decoding a todo)

```ts
import { Schema } from "effect";

const Todo = Schema.Struct({
  done: Schema.Boolean,
  id: Schema.Int,
  title: Schema.String,
});

// { readonly done: boolean; readonly id: number; readonly title: string }
type Todo = typeof Todo.Type;

const decode = Schema.decodeUnknownEffect(Todo);
// (input: unknown) => Effect<Todo, SchemaError, never>
```

Effect RPC and `HttpApi` use schemas for every payload, response and error, so the client and server agree on them. That is how the [RPC](/rpc) and [HTTP API](/http) pages get typed errors from the server. `Schema.TaggedError` defines a tagged error that can be sent over the network.

Read more in [Introduction to Effect Schema](https://effect.website/docs/v4/schema/introduction).

## Stream

An effect produces one value. A `Stream` produces any number of them over time, like an async iterable that can fail with typed errors and is lazy like an effect:

```ts
import { Stream } from "effect";

// 0, 1, 2, … one a second.
const seconds = Stream.tick("1 second").pipe(
  Stream.scan(
    () => 0,
    (n) => n + 1
  )
);
```

An atom backed by a stream holds its latest value, and a pull atom reads it a chunk at a time. See [Streams](/streams).

Read more in [Introduction to Streams](https://effect.website/docs/v4/stream/introduction).

<Aside type="note" title="Importing">

Everything on this page comes from the `effect` package. Atoms come from `effect/reactivity`, which is part of the same package.

</Aside>
