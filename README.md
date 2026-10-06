# effect-atom-svelte

Svelte 5 bindings for Effect Atom (`effect/reactivity`): hooks with a reactive `current`, async atoms you can `await` in markup, and server rendering with hydration.

[![npm](https://img.shields.io/npm/v/effect-atom-svelte)](https://www.npmjs.com/package/effect-atom-svelte) [![CI](https://img.shields.io/github/actions/workflow/status/jarrednorrisdev/effect-atom-svelte/ci.yml?branch=main&label=CI)](https://github.com/jarrednorrisdev/effect-atom-svelte/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/npm/l/effect-atom-svelte)](LICENSE) [![effect peer version](https://img.shields.io/npm/dependency-version/effect-atom-svelte/peer/effect)](#compatibility) [![svelte peer version](https://img.shields.io/npm/dependency-version/effect-atom-svelte/peer/svelte)](#compatibility)

**[Documentation](https://atom.jarrednorris.dev)** · [Installation](https://atom.jarrednorris.dev/installation) · [API reference](https://atom.jarrednorris.dev/reference) · [Changelog](packages/effect-atom-svelte/CHANGELOG.md)

This is a community project, not part of Effect: see [Project status](#project-status).

## What you get

Effect Atom keeps state in **atoms**: small reactive values that hold plain data, derive from other atoms, or run an `Effect` or a `Stream`. The API follows `@effect/atom-react`, so if you have used atoms in React, only the hooks change.

- **Hooks with a reactive `current`**, Svelte's convention for reactive values. Read it in markup, assign to it, or `bind:` to it. See [Reading and writing](https://atom.jarrednorris.dev/reading-and-writing).
- **Async atoms you can `await`.** `useAtomSuspense` and `useAtomResult` build on Svelte's async support, so pending and failed states go through `<svelte:boundary>`. See [Suspense](https://atom.jarrednorris.dev/suspense).
- **Server rendering and hydration.** Each request gets its own registry, and the results of serializable atoms travel to the browser, which starts from them instead of running the effects again. See [Server rendering](https://atom.jarrednorris.dev/server-rendering) and [Hydration](https://atom.jarrednorris.dev/hydration).
- **Effect services in components.** `AtomRpc` and `AtomHttpApi` turn an Effect RPC group or `HttpApi` into atoms for queries and mutations. See [RPC](https://atom.jarrednorris.dev/rpc) and [HTTP API](https://atom.jarrednorris.dev/http).
- **Scoped atoms** for one atom per component subtree, and SvelteKit `handleError` hooks that keep an Effect error's `_tag`. See [Scoped atoms](https://atom.jarrednorris.dev/scoped-atoms) and [SvelteKit](https://atom.jarrednorris.dev/sveltekit).

The docs site has a live example on most pages, and the code under each one is the file that runs.

## Install and set up

```sh
npm install effect-atom-svelte "effect@~4.0.0"
```

Turn on Svelte's async mode, which the async hooks and server rendering need. In SvelteKit 3, pass it to `sveltekit()` in `vite.config.ts`:

```ts
// vite.config.ts
sveltekit({
  compilerOptions: { experimental: { async: true } },
});
```

Then put a registry around your app, in the root layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

On the server, the provider creates a registry for each request, so visitors never see each other's state. Without one, the server throws `No AtomRegistry in context`. [Installation](https://atom.jarrednorris.dev/installation) covers the registry options and apps without SvelteKit.

## Recipes

Each recipe is a complete component. The docs page linked under it explains the details.

### Read and write an atom

```svelte
<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
</script>

<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const setCount = useAtomSet(countAtom);
</script>

<input type="number" bind:value={count.current} />
<button onclick={() => setCount((n) => n + 1)}>Add one</button>
<p>{count.current} × 2 = {doubled.current}</p>
```

Define atoms at module level, in `<script module>` or a `.ts` file, not in a component's script. Don't destructure `current`: `const { current } = useAtomValue(atom)` reads once and never updates. See [Reading and writing](https://atom.jarrednorris.dev/reading-and-writing) and [Derived atoms](https://atom.jarrednorris.dev/derived-atoms).

### Await an async atom in markup

```svelte
<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const greetingAtom = Atom.make(
    Effect.succeed("Hello from an Effect").pipe(Effect.delay("1 second"))
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";

  const greeting = useAtomSuspense(greetingAtom);
  const refresh = useAtomRefresh(greetingAtom);
</script>

<svelte:boundary>
  <p>{await greeting.current}</p>
  <button onclick={refresh}>Load again</button>

  {#snippet pending()}<p>Loading…</p>{/snippet}
  {#snippet failed(error, reset)}
    <p>Something went wrong: {String(error)}</p>
    <button onclick={reset}>Try again</button>
  {/snippet}
</svelte:boundary>
```

`greeting.current` is a promise of the value. It rejects when the effect fails, which shows the `failed` snippet. See [Async atoms](https://atom.jarrednorris.dev/async-atoms) and [Suspense](https://atom.jarrednorris.dev/suspense).

### Render on the server and hydrate

Give an atom a key and a schema with `Atom.serializable`, and await it with `useAtomResult` at the top of a page's script:

```ts
// src/routes/todos/todos.ts
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String });
type Todo = typeof Todo.Type;

// Stands in for a real request, such as an AtomRpc or AtomHttpApi query.
const fetchTodos: Effect.Effect<ReadonlyArray<Todo>> = Effect.succeed([
  { id: 1, title: "Read the docs" },
]).pipe(Effect.delay("200 millis"));

export const todosAtom = Atom.make(fetchTodos).pipe(
  Atom.serializable({
    key: "app/todos",
    schema: AsyncResult.Schema({ success: Schema.Array(Todo) }),
  })
);
```

```svelte
<!-- src/routes/todos/+page.svelte -->
<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import { todosAtom } from "./todos.ts";

  const todos = await useAtomResult(todosAtom);
</script>

{#if todos.current._tag === "Success"}
  <ul>
    {#each todos.current.value as todo (todo.id)}
      <li>{todo.title}</li>
    {/each}
  </ul>
{:else if todos.current._tag === "Failure"}
  <p>Could not load the todos.</p>
{/if}
```

The server waits for the first result, renders it and sends it with the page. The browser starts from that result instead of running the effect again. Call these hooks before the script's first `await`, or the browser misses the server's result. The results are plain text in the page's HTML, so never serialize data the visitor mustn't see. See [Server rendering](https://atom.jarrednorris.dev/server-rendering) and [Hydration](https://atom.jarrednorris.dev/hydration).

## API at a glance

Every export, with a link to its entry in the [API reference](https://atom.jarrednorris.dev/reference). Every hook that takes an atom or a ref also takes a getter, such as `() => todoAtom(id)`, and follows whichever atom it returns. The exception is `useAtomRefProp`, which takes the ref itself.

### Components

| Export | What it does |
| --- | --- |
| [`RegistryProvider`](https://atom.jarrednorris.dev/reference#RegistryProvider) | Puts a registry in context for its children: one per request on the server, one per mount in the browser. |
| [`HydrationBoundary`](https://atom.jarrednorris.dev/reference#HydrationBoundary) | Hydrates state from `Hydration.dehydrate`, for example returned by a `load` function or a remote function. |

### Hooks

| Export | What it does |
| --- | --- |
| [`useAtomValue`](https://atom.jarrednorris.dev/reference/Hooks#useAtomValue) | Reads an atom through `current`, optionally through a transform. |
| [`useAtom`](https://atom.jarrednorris.dev/reference/Hooks#useAtom) | Reads and writes a writable atom through `current`, so `bind:value` works. |
| [`useAtomSet`](https://atom.jarrednorris.dev/reference/Hooks#useAtomSet) | Returns a setter that takes a value or an updater. The `"promise"` and `"promiseExit"` modes wait for the result. |
| [`useAtomSuspense`](https://atom.jarrednorris.dev/reference/Hooks#useAtomSuspense) | Exposes an async atom as a promise to `await` in markup, inside a `<svelte:boundary>`. |
| [`useAtomResult`](https://atom.jarrednorris.dev/reference/Hooks#useAtomResult) | Awaited in the script: waits for the first result, then returns a live `AsyncResult`. |
| [`useAtomRefresh`](https://atom.jarrednorris.dev/reference/Hooks#useAtomRefresh) | Returns a function that runs the atom again. |
| [`useAtomMount`](https://atom.jarrednorris.dev/reference/Hooks#useAtomMount) | Keeps an atom alive while the component lives, even when nothing reads it. |
| [`useAtomSubscribe`](https://atom.jarrednorris.dev/reference/Hooks#useAtomSubscribe) | Calls a function on every change while the component lives. |
| [`useAtomInitialValues`](https://atom.jarrednorris.dev/reference/Hooks#useAtomInitialValues) | Sets starting values for atoms from a component, such as from a prop. |
| [`useAtomRef`](https://atom.jarrednorris.dev/reference/Hooks#useAtomRef) | Reads an `AtomRef` through `current`. |
| [`useAtomRefProp`](https://atom.jarrednorris.dev/reference/Hooks#useAtomRefProp) | Returns the `AtomRef` for one property of a ref, to read or set it. |
| [`useAtomRefPropValue`](https://atom.jarrednorris.dev/reference/Hooks#useAtomRefPropValue) | Reads one property of an `AtomRef` through `current`. |

Types: [`AtomInput`](https://atom.jarrednorris.dev/reference/Hooks#AtomInput), [`AtomValue`](https://atom.jarrednorris.dev/reference/Hooks#AtomValue), [`AtomState`](https://atom.jarrednorris.dev/reference/Hooks#AtomState), [`WriteMode`](https://atom.jarrednorris.dev/reference/Hooks#WriteMode), [`WriteOptions`](https://atom.jarrednorris.dev/reference/Hooks#WriteOptions), [`SuspenseOptions`](https://atom.jarrednorris.dev/reference/Hooks#SuspenseOptions), [`ResultOptions`](https://atom.jarrednorris.dev/reference/Hooks#ResultOptions).

### Registry

| Export | What it does |
| --- | --- |
| [`provideRegistry`](https://atom.jarrednorris.dev/reference/RegistryContext#provideRegistry) | `RegistryProvider` from a component's script. Returns the registry. |
| [`getRegistry`](https://atom.jarrednorris.dev/reference/RegistryContext#getRegistry) | Returns the nearest registry, to read or write atoms outside a hook. Call it while the component initializes. |

Types: [`RegistryOptions`](https://atom.jarrednorris.dev/reference/RegistryContext#RegistryOptions), [`ProvideRegistryOptions`](https://atom.jarrednorris.dev/reference/RegistryContext#ProvideRegistryOptions), [`ProvideRegistryCommon`](https://atom.jarrednorris.dev/reference/RegistryContext#ProvideRegistryCommon), [`ProvideNewRegistry`](https://atom.jarrednorris.dev/reference/RegistryContext#ProvideNewRegistry), [`ProvideExistingRegistry`](https://atom.jarrednorris.dev/reference/RegistryContext#ProvideExistingRegistry).

### Scoped atoms

| Export | What it does |
| --- | --- |
| [`ScopedAtom.make`](https://atom.jarrednorris.dev/reference/ScopedAtom#make) | Creates an atom per component subtree: a parent calls `provide`, and descendants call `use`. |

Types: [`ScopedAtom.ScopedAtom`](https://atom.jarrednorris.dev/reference/ScopedAtom#ScopedAtom), [`ScopedAtom.MakeOptions`](https://atom.jarrednorris.dev/reference/ScopedAtom#MakeOptions), [`ScopedAtom.TypeId`](https://atom.jarrednorris.dev/reference/ScopedAtom#TypeId).

### SvelteKit (`effect-atom-svelte/sveltekit`)

| Export | What it does |
| --- | --- |
| [`handleClientError`](https://atom.jarrednorris.dev/reference/SvelteKit#handleClientError) | A client `handleError` hook that keeps the message and `_tag` of errors your code throws. |
| [`handleServerError`](https://atom.jarrednorris.dev/reference/SvelteKit#handleServerError) | A server `handleError` hook that keeps the `_tag`, but not the message, which could expose details of the server. |

Types: [`CaughtError`](https://atom.jarrednorris.dev/reference/SvelteKit#CaughtError), [`EffectErrorBody`](https://atom.jarrednorris.dev/reference/SvelteKit#EffectErrorBody).

### Re-exported from `effect/reactivity`

[`Atom`](https://atom.jarrednorris.dev/reference#Atom), [`AsyncResult`](https://atom.jarrednorris.dev/reference#AsyncResult), [`AtomRegistry`](https://atom.jarrednorris.dev/reference#AtomRegistry), [`AtomRef`](https://atom.jarrednorris.dev/reference#AtomRef), [`AtomRpc`](https://atom.jarrednorris.dev/reference#AtomRpc), [`AtomHttpApi`](https://atom.jarrednorris.dev/reference#AtomHttpApi) and [`Hydration`](https://atom.jarrednorris.dev/reference#Hydration), so an app can import everything from one place. They are the same modules as in `effect/reactivity`.

## Compatibility

| Package | Supported | Notes |
| --- | --- | --- |
| `effect` | `~4.0.0` | Pinned to 4.0.x, not `^4.0.0`: the bindings use parts of the atom registry that aren't public API, which a minor release of `effect` can change. Load one copy of `effect` in your app: see [Two copies of effect](https://atom.jarrednorris.dev/troubleshooting#two-copies-of-effect). |
| `svelte` | `^5.57.2` | `experimental.async` is needed for `useAtomSuspense`, `useAtomResult` and server rendering. The other hooks work without it. |
| `@sveltejs/kit` | `^3.0.0` or `^2.0.0`, optional | The docs site and its tests run on SvelteKit 3. On SvelteKit 2, the `effect-atom-svelte/sveltekit` error hooks work with less detail: see [SvelteKit](https://atom.jarrednorris.dev/sveltekit). |

SvelteKit is optional: see [Plain Svelte](https://atom.jarrednorris.dev/installation#plain-svelte-no-sveltekit). The test suites run in Chromium, Firefox and WebKit.

## Coming from `@effect/atom-react`

Your atoms, families, runtimes, `AtomRpc` and `AtomHttpApi` clients carry over unchanged, as they come from `effect/reactivity`. What changes is how a component reads them, because a Svelte component's script runs once rather than on every render:

| `@effect/atom-react` | effect-atom-svelte |
| --- | --- |
| `const [count, setCount] = useAtom(countAtom)` | `const count = useAtom(countAtom)`, then read and assign `count.current` |
| `useAtomValue(todoAtom(id))` follows `id` on each render | Pass a getter: `useAtomValue(() => todoAtom(id))` |
| `useAtomSuspense` suspends, inside `<Suspense>` | `useAtomSuspense` returns a promise you `await` in markup, inside `<svelte:boundary>` |
| No provider: a module-level default registry, on the server too | No provider: a shared default registry in the browser, and an error on the server |
| Some queries are fetched again straight after hydration | Nothing runs again after hydration unless you set `revalidateOnHydrate` |

[Migrating from atom-react](https://atom.jarrednorris.dev/migrating-from-react) maps every hook, the registry and server rendering.

## Project status

- **0.x.** A minor release can change the API. Every change is in the [changelog](packages/effect-atom-svelte/CHANGELOG.md).
- **A community project** by Jarred Norris. It is not part of Effect, and the Effect team neither makes nor endorses it.
- **Written with AI.** Most of the code and docs were written with the help of AI (Claude Opus 5.5). Its behavior is covered by tests in Chromium, Firefox and WebKit.

effect-atom-svelte was inspired by Thomas Foster's [Svelte Atoms pull request](https://github.com/Effect-TS/effect-smol/pull/2443) to effect-smol. The design of the docs' live examples is inspired by Kit Langton's [Visual Effect](https://effect.kitlangton.com/).

## Contributing

Bug reports and suggestions are welcome in [GitHub issues](https://github.com/jarrednorrisdev/effect-atom-svelte/issues). This is a Bun and Turborepo monorepo: the library is in `packages/effect-atom-svelte`, and the docs site, which is also the demo app, is in `apps/demo`.

```sh
bun install
bun run check   # type-checks every package, building the library first
bun run test    # Vitest and Playwright, in Chromium, Firefox and WebKit
bun run lint
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the repository layout, running the docs site locally, the tests, changesets and releases.

## Star history

<a href="https://www.star-history.com/#jarrednorrisdev/effect-atom-svelte&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jarrednorrisdev/effect-atom-svelte&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=jarrednorrisdev/effect-atom-svelte&type=Date" />
    <img alt="Star history of jarrednorrisdev/effect-atom-svelte" src="https://api.star-history.com/svg?repos=jarrednorrisdev/effect-atom-svelte&type=Date" />
  </picture>
</a>

## License

[MIT](LICENSE)
