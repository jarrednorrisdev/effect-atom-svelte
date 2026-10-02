# effect-atom-svelte

Svelte 5 bindings for [Effect Atom](https://effect.website) (`effect/reactivity`), in the shape of the official `@effect/atom-react` and `@effect/atom-vue` adapters.

**Status:** pre-release, not yet published. Targets `effect` 4.0, Svelte 5.57+ and SvelteKit 3. Server rendering and the async hooks need Svelte's `experimental.async` compiler option.

## Setup

Put a registry at the root. On the server it gives every request its own registry and disposes it when rendering ends; in the browser it lives for the session.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

`RegistryProvider` takes the `AtomRegistry.make` options (`initialValues`, `scheduleTask`, `defaultIdleTTL`) or an existing `registry`, plus `revalidateOnHydrate` (see [Server rendering and hydration](#server-rendering-and-hydration)). `provideRegistry()` does the same from a component script.

Without a provider the browser falls back to a shared registry; the server throws instead, because a module-level registry would share atom state between concurrent requests.

## Reading and writing

Hooks return objects with a reactive `.current`, Svelte's convention for reactive values. Every hook accepts an atom, or a getter so it follows a different atom when reactive state changes.

```svelte
<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom); // read and assign .current; works with bind:
  const parity = useAtomValue(countAtom, (n) => (n % 2 ? "odd" : "even"));
  const todo = useAtomValue(() => todoAtom(selected.current)); // follows the selected atom
  const save = useAtomSet(saveAtom, { mode: "promise" }); // or "promiseExit", or the default "value"
</script>

<input bind:value={count.current} type="number" />
```

| Hook | Does |
| --- | --- |
| `useAtomValue(atom, f?)` | Reads, optionally transformed. Mounted while something reactive reads it. |
| `useAtom(atom)` | Reads and writes through `.current`. |
| `useAtomSet(atom, { mode })` | Setter. `promise` and `promiseExit` modes take an `AbortSignal`. |
| `useAtomMount(atom)` | Keeps an atom mounted for the component's lifetime without reading it. |
| `useAtomRefresh(atom)` | Returns a function that recomputes the atom. |
| `useAtomSubscribe(atom, f, { immediate })` | Calls `f` on each change. |
| `useAtomInitialValues(pairs)` | Sets starting values once per registry. |
| `useAtomRef`, `useAtomRefPropValue` | Read an `AtomRef` or one of its properties. `useAtomRefProp` returns the prop ref. |
| `useAtomResult(atom)` | `await` an async atom's first result, then a live `AsyncResult`. SSR and hydration. With a getter, a later atom is followed without awaiting again. |
| `useAtomSuspense(atom, options)` | An async atom as a promise for `await` in markup. |
| `ScopedAtom.make(f)` | An atom per subtree: `provide(input)` in a parent, `use()` below it. |
| `<HydrationBoundary state>` | Hydrates state from `Hydration.dehydrate`, for example returned by a remote function. |

The package also re-exports `AsyncResult`, `Atom`, `AtomHttpApi`, `AtomRef`, `AtomRegistry`, `AtomRpc` and `Hydration` from `effect/reactivity`.

## Async components

With `experimental.async`, a component can `await` atoms directly.

```svelte
<script lang="ts">
  const todos = await useAtomResult(todosAtom); // SSR waits; hydration reuses the server's result
</script>

<svelte:boundary>
  {#each await user.current.todos as todo}…{/each}
  {#snippet pending()}Loading…{/snippet}
</svelte:boundary>
```

- Hooks can be called before or after top-level `await`s in a component script: Svelte restores the component context after each one. Like any Svelte lifecycle function, a hook cannot be called after an `await` inside your own async helper, because only top-level awaits get the context back. Awaiting several atoms in sequence makes requests that could run in parallel wait for each other; start them together with `await Promise.all([useAtomResult(a), useAtomResult(b)])` when they are independent.
- Every hook takes an atom or a getter (`() => atom`) that follows reactive state. `await useAtomResult(() => userAtom(id))` waits only for the first atom; when `id` changes, the handle switches to the new atom's result, which is usually `Initial` until it loads. Use `useAtomSuspense` when a switch should show the boundary's pending state again.
- `useAtomSuspense(...).current` is a promise that stays the same object while the result is unchanged, so dependents only re-run on real updates. Failures reject with the squashed cause; `includeFailure: true` resolves with the `Failure` instead, and `suspendOnWaiting: true` treats a refresh as pending again.

## Server rendering and hydration

- An atom read on the server stays mounted for the request, so the registry does not sweep it while rendering is suspended, and is released when rendering ends. That includes a registry you pass to `RegistryProvider`: it is not disposed, but each request's atoms are released from it and every request embeds its own hydration seeds. Atoms with an `Atom.withServerValue` override are never computed on the server.
- Give async atoms a serialization key (`AtomRpc.query(..., { serializationKey })`, `AtomHttpApi.query(..., { serializationKey })` or `Atom.serializable`). `useAtomResult` and `useAtomSuspense` then pass the encoded result to the client through Svelte's `hydratable`, so hydration does not wait on the network. Only a server value seeds the registry, and only while a component using it is still mounted; after client-side navigation the atom is fetched in the browser as usual. Two different atoms with the same key throw.
- **Hydrated atoms are not fetched again.** The server's value is milliseconds old, so `useAtomResult` and `useAtomSuspense` keep it until something refreshes the atom, such as a mutation on its reactivity keys. **This differs from `@effect/atom-react`**, where a query wrapped by `Atom.withReactivity` (as `AtomRpc.query` and `AtomHttpApi.query` do for `reactivityKeys`) or by `swr`, `debounce`, `withRefresh` or `makeRefreshOnSignal` is fetched again straight after hydration, as a side effect of how `AtomRegistry` seeds wrapped atoms. To fetch again once hydration is done, set `revalidateOnHydrate` on `RegistryProvider`, or on a hook (`useAtomSuspense(atom, { revalidateOnHydrate: true })`), which overrides the provider. When components share a serialization key, the atom is fetched again if any of them asks. `HydrationBoundary` hydrates through `Hydration.hydrate` and keeps `AtomRegistry`'s behaviour.
- A `<svelte:boundary>` with a `pending` snippet renders that snippet on the server and leaves its content to the client. Leave `pending` out where the first paint needs the data.
- Browser-only atoms, such as `Atom.kvs` with `localStorage` and `Atom.refreshOnWindowFocus`, throw when computed on the server. See [Browser-only atoms](#browser-only-atoms).
- **A getter must pick the same atom on the server and on the first browser render.** The server's value reaches the browser only for the atom the getter returned on the server. If the browser's first render picks another serializable atom, for example from a filter stored with `Atom.kvs` in `localStorage`, there is no server value for it: Svelte throws `hydratable_missing_but_required` in development, and in a production build it warns, fetches in the browser and the markup can mismatch. `Atom.withServerValue` does not help here, because it only changes what the server reads, and is what makes the two sides differ. Base the first choice on state the server also has (the URL, a cookie, page data), or keep the server's choice until the component has mounted, then switch, which fetches in the browser as any later switch does:

  ```svelte
  <script lang="ts">
    import { onMount } from "svelte";

    const saved = useAtomValue(savedFilterAtom); // Atom.kvs, withServerValue(() => "all")
    let mounted = $state(false);
    onMount(() => (mounted = true));
    const todos = useAtomSuspense(() => todosFor(mounted ? saved.current : "all"));
  </script>
  ```

## Browser-only atoms

`Atom.kvs` with `KeyValueStore.layerStorage(() => localStorage)` throws on the server, where there is no `localStorage`. Give the runtime an in-memory store there, so the server renders the default value:

```ts
import { BROWSER } from "esm-env"; // or `browser` from SvelteKit's $app/env

const storage = Atom.runtime(
  BROWSER
    ? KeyValueStore.layerStorage(() => localStorage)
    : KeyValueStore.layerMemory
);
const draftAtom = Atom.kvs({
  key: "draft",
  runtime: storage,
  schema: Schema.String,
  defaultValue: () => "",
});
```

`Atom.withServerValue(() => "")` on the atom works too; it is the only option for an atom you cannot give a runtime, such as `Atom.refreshOnWindowFocus`, which listens on `window` when computed (until Effect guards it for server rendering).

Either way the server cannot know a value stored only in the browser: the page paints the default, and the stored value replaces it once the page hydrates. That is fine for a draft, not for a theme or a locale. For preferences that must be right on first paint, store them in a cookie, which the browser sends with every request. Back `Atom.kvs` with a `KeyValueStore` that reads and writes `document.cookie` in the browser and reads the request's cookies on the server, and pass those cookies to the registry with `initialValues`. In SvelteKit:

```ts
// src/lib/preferences.ts
export const preferenceCookiesAtom = Atom.make<Record<string, string>>({}).pipe(
  Atom.keepAlive
);

export const cookieStorage = Atom.runtime((get) =>
  Layer.succeed(KeyValueStore.KeyValueStore)(
    browser
      ? documentCookieStore
      : requestCookieStore(get(preferenceCookiesAtom))
  )
);

export const themeAtom = Atom.kvs({
  key: "pref-theme",
  runtime: cookieStorage,
  schema: Schema.Literals(["light", "dark"]),
  defaultValue: () => "light" as const,
});

// src/routes/+layout.server.ts: pass on preference cookies only, as page data is embedded in the HTML
export const load = ({ cookies }) => ({
  preferenceCookies: Object.fromEntries(
    cookies
      .getAll()
      .filter(({ name }) => name.startsWith("pref-"))
      .map(({ name, value }) => [name, value])
  ),
});
```

```svelte
<!-- src/routes/+layout.svelte -->
<RegistryProvider initialValues={[[preferenceCookiesAtom, data.preferenceCookies]]}>
```

The two stores are built with `KeyValueStore.makeStringOnly`; the demo app's `src/lib/preferences.ts` has a complete version. `preferenceCookiesAtom` is kept alive because the registry would otherwise sweep it, and its value with it, before a component reads the preference.

A stored value that picks which atom to read, such as a saved filter, also has to match on both sides: see [a getter must pick the same atom](#server-rendering-and-hydration) above. A cookie-backed filter avoids the problem, because the server picks the same atom as the browser.

## SvelteKit notes

- SvelteKit runs errors through `handleError` before a boundary's `failed` snippet sees them; by default the snippet only gets `{ status: 500, message: "Internal Error" }`, so an Effect error loses its `_tag`. To show a typed error, use `includeFailure: true` and read the `Failure`, or use the hooks from `effect-atom-svelte/sveltekit`, which add the `_tag` to `App.Error` as `tag`. The client hook also keeps the message; the server hook keeps SvelteKit's `"Internal Error"` so the message cannot expose details of the server (it matters when a `failed` snippet renders on the server). Both log the error like SvelteKit's default hooks and leave `error(...)` and SvelteKit's own errors, such as 404s, as they are. The entry point does not import SvelteKit.

  ```ts
  // src/hooks.client.ts
  export { handleClientError as handleError } from "effect-atom-svelte/sveltekit";

  // src/hooks.server.ts
  export { handleServerError as handleError } from "effect-atom-svelte/sveltekit";

  // src/app.d.ts
  declare global {
    namespace App {
      interface Error {
        tag?: string;
      }
    }
  }
  export {};
  ```

  ```svelte
  {#snippet failed(error)}
    {#if (error as App.Error).tag === "TodoNotFound"}No such todo{:else}{(error as App.Error).message}{/if}
  {/snippet}
  ```

  To log to a service or set other fields, write your own hook and call these from it.

- Data can come from `await` in components alone; no `load` or server files are needed.

## Behaviour worth knowing

- Promise-mode setters resolve with the atom's next settled result. When a second `Atom.fn` call supersedes one in flight, both promises resolve with the second call's result, as in `@effect/atom-react`.
- A mutation still running when its component unmounts completes: the promise holds its own subscription, so navigating away does not cancel a write.
- A read that is abandoned stops waiting. When a `useAtomSuspense` getter moves to another atom while the old one is still loading, or the component unmounts, the old wait lets go of its atom, so the registry disposes it and interrupts its request. The abandoned promise rejects with Svelte's own abort reason, which Svelte ignores, so a render still waiting on it keeps waiting for the next value rather than showing the interruption. The same goes for `await useAtomResult(...)` in a component removed before the result arrives. A `useAtomSuspense` promise read outside a template or effect (a top-level `await` in the script, an event handler) is held until the component is destroyed.
- In a monorepo, make sure the bundler loads one copy of `effect`. Workspace packages compiled from source can otherwise get their own, and their schemas and service tags stop matching (`resolve: { dedupe: ["effect"] }` in Vite).

## How it works

Each read goes through `createSubscriber` from `svelte/reactivity`, subscribed to the registry while something reactive reads `.current`. The registry notifies subscribers synchronously while it computes an atom, and Svelte throws `state_unsafe_mutation` if state changes while a template or `$derived` is evaluating. Reads are counted, and a notification raised during one is delivered on a microtask; outside a read, notifications stay synchronous so event-handler writes update in the same tick.

## Development

```sh
bun run --cwd packages/effect-atom-svelte test   # Vitest: browser mode (Chromium, Firefox, WebKit) and Node SSR
bun run --cwd packages/effect-atom-svelte check  # svelte-check
bun run --cwd apps/demo test                     # Playwright against a production build of the demo
```

The tests run real `AtomRpc` and `AtomHttpApi` clients against `@demo/domain`'s server in-process.
