---
title: Troubleshooting
description: Common errors and surprises, what causes them and how to fix them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

This page collects the errors and surprises people run into most often, with what causes each one and how to fix it.

## "No AtomRegistry in context"

The server throws this when a hook runs with no registry above it. Every hook reads from the nearest `RegistryProvider`, and on the server there is no fallback, because one registry shared at module level would leak one visitor's state into another visitor's page.

Put a `RegistryProvider` around the whole app, in the root layout. See [Add a registry](/installation#add-a-registry).

In the browser, a component with no provider above it uses a shared default registry, so a missing provider only shows up once the page renders on the server.

### "can only be used during component initialisation"

The hooks find the registry through Svelte's context, which is only available while a component initializes. Svelte throws `lifecycle_outside_component` when a hook is called later, such as from an event handler, a `setTimeout`, or after an `await` inside a function of your own. Call hooks at the top level of the script. To use the registry later, keep what the hook returns, or call [`getRegistry()`](/cookbook#the-registry-itself) at the top level and keep the registry.

## Two copies of effect

In a monorepo, a workspace package compiled from source can get its own copy of `effect`. Two copies have separate schemas and service tags, which then stop matching.

Make sure the bundler loads one copy, for example with `resolve.dedupe` in `vite.config.ts`:

**Example** (Loading one copy of effect)

```ts
// vite.config.ts
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { dedupe: ["effect"] },
});
```

If Vitest has a config of its own, it needs the same setting. To see how many copies are installed, ask your package manager, for example with `npm ls effect`.

## "hydratable_missing_but_required"

While the page hydrates, a hook asked for the server's result for an atom the server never rendered. Svelte throws this in development. A production build only warns, then runs the atom in the browser, and the markup can mismatch.

It happens when a hook's getter picks a different serializable atom in the browser than it did on the server, usually because the choice depends on state only the browser has, such as `localStorage`. Base the first choice on state the server also has, or keep the server's choice until the component has mounted. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

## Handlers after an await

In Svelte 5.57, a production build attaches event handlers before the script has finished its top-level awaits. A handler that a hook returns after an `await` is still `undefined` at that point, so `onclick={refresh}` does nothing. Development builds don't show the problem.

**Example** (A refresh button that works)

```svelte
<script lang="ts">
  import { useAtomRefresh, useAtomResult } from "effect-atom-svelte";

  // Called before the await, so `refresh` exists when the button is set up.
  const refresh = useAtomRefresh(todosAtom);
  const todos = await useAtomResult(todosAtom);
</script>

<button onclick={refresh}>Refresh</button>
```

Either call such hooks before the first `await`, or wrap the handler in an arrow function, `onclick={() => refresh()}`, which looks `refresh` up when the button is clicked.

<Aside type="tip" title="Test against a production build">

Because development builds hide this, run your end-to-end tests against `vite build` and `vite preview`, not the dev server.

</Aside>

## My state reset

An atom's value lives in a registry, and the registry only keeps it while something needs it. When a value goes back to its default, look for one of these:

- **Nothing was reading it.** When the last reader goes away, for example when you navigate to a page that doesn't show it, the registry disposes of the atom, and the next read starts again from the initial value. Use `Atom.keepAlive`, an idle TTL or `useAtomMount`. See [Lifetimes](/lifetimes#keeping-atoms-alive).
- **It was set through `initialValues`.** Those atoms are disposed like any other, so give them `Atom.keepAlive`.
- **The atom is created inside a component.** `Atom.make` in a component's script makes a new atom each time the component is created. Define atoms at module level, in `<script module>` or a `.ts` file, or use a [family](/families) or a [scoped atom](/scoped-atoms) for one atom per key or per subtree.
- **A second `RegistryProvider`.** Components below a nested provider read its registry, not the root one, and the provider disposes of its registry when it is destroyed. Keep one provider at the root unless you want a separate registry.
- **A save never finished.** A mutation called with the default `"value"` mode is interrupted when its component is destroyed, so navigating away mid-save abandons it. See [Mutations](/mutations#waiting-for-the-result).
- **The page was reloaded.** The browser's registry lasts one page load. To keep a value across reloads, store it with [`Atom.kvs`](/browser#persisting-to-localstorage) or in the URL.

## Relative URLs on the server

When a page renders on the server, its queries run there too. A client built with a relative URL, such as `/api/rpc`, works in the browser, where the page's origin fills in the rest, but on the server the request fails with an `InvalidUrlError`.

Give the server an absolute URL when you build the client:

**Example** (An absolute URL on the server)

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { TodosRpcs } from "./rpc.ts";

const origin = import.meta.env.SSR ? "http://localhost:3010" : "";

export class TodosRpc extends AtomRpc.Service<TodosRpc>()("app/TodosRpc", {
  group: TodosRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: `${origin}/api/rpc` }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])
  ),
}) {}
```

For `AtomHttpApi`, set `baseUrl` the same way. In a real app, read the server's origin from an environment variable rather than writing it into the code.

## Plain Svelte (no SvelteKit)

effect-atom-svelte doesn't depend on SvelteKit. Only `effect-atom-svelte/sveltekit`, which formats errors for SvelteKit's `handleError` hook, is specific to it, and you can leave it out. Without SvelteKit:

- **Async mode.** Pass `compilerOptions: { experimental: { async: true } }` to `svelte()` from `@sveltejs/vite-plugin-svelte`. See [Turn on async mode](/installation#turn-on-async-mode).
- **The registry.** Wrap your root component's markup in `RegistryProvider`, as you would the root layout.
- **Server rendering.** Await `render` from `svelte/server`: it waits for the async work in your components, then returns the page's `head` and `body`. The results for [hydration](/hydration) are written into `head`, so put it in the page's `<head>`. In the browser, start the app with `hydrate` from `svelte` instead of `mount`.

A client-only app needs none of the server rendering setup. It still needs async mode for `useAtomSuspense` and `useAtomResult`.
