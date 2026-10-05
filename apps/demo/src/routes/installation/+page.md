---
title: Installation
description: Install the package, turn on Svelte's async mode and add a registry.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import InstallCommand from "#lib/docs/install-command.svelte";
</script>

Setting up takes three steps: install the packages, turn on Svelte's experimental async support if you need it, and put a registry at the root of your app.

## Install the packages

effect-atom-svelte needs `effect` 4.0.x alongside it. Atoms come from `effect/reactivity`, which is part of `effect` itself. The commands pin `effect@~4.0.0`, as the bindings use parts of the atom registry that aren't public API, and a minor release such as 4.1 can change them.

<InstallCommand />

The app must load one copy of `effect`. See [Two copies of effect](/troubleshooting#two-copies-of-effect) if a monorepo gives it two.

## Turn on async mode

The async hooks (`useAtomSuspense`, `useAtomResult`) and server rendering depend on Svelte's experimental async support. The other hooks, such as `useAtom` and `useAtomValue`, work without it, so an app that only renders in the browser and doesn't use those two can skip this step. SvelteKit 3 reads Svelte's options from `vite.config.ts`, so add `compilerOptions` to the options you already pass to `sveltekit()`:

**Example** (Turning on experimental async in SvelteKit 3)

```ts
// vite.config.ts
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
    }),
  ],
});
```

Without SvelteKit, see [Plain Svelte](#plain-svelte-no-sveltekit). SvelteKit's `experimental: { remoteFunctions: true }` is not needed here; turn it on only if your app uses remote functions.

## Add a registry

An atom doesn't hold a value itself. It describes how to compute one, and an **atom registry** stores the values. Every hook reads from the nearest registry above it, so put a `RegistryProvider` around your whole app:

**Example** (Providing a registry from the root layout)

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  const { children } = $props();
</script>

<RegistryProvider>{@render children()}</RegistryProvider>
```

In the browser, one registry lives for the whole session. On the server, the provider creates one for each request, so visitors never see each other's state: see [One registry per request](/server-rendering#one-registry-per-request).

<Aside type="danger" title="Always provide a registry when you render on the server">

Without a provider, the browser falls back to a shared default registry, but the server throws `No AtomRegistry in context`.

</Aside>

### Registry options

Most apps need no options. Two are worth knowing from the start:

| Option | Does |
| --- | --- |
| `initialValues` | Starting values, as `[atom, value]` pairs, such as data from a `load` function. |
| `registry` | An existing registry to provide instead of creating one. You dispose of it yourself. Passing it with `initialValues`, `defaultIdleTTL`, `timeoutResolution` or `scheduleTask` throws, as those only shape a new registry. `revalidateOnHydrate` still applies. |

<Aside type="danger" title="Never share a registry between requests">

On the server, don't pass a `registry` that outlives the request, such as one made at module level. Every visitor would read and write the same atom values, and the results sent to the browser for [hydration](/hydration) would come from it too, so one visitor's data could end up in another's page.

</Aside>

The rest come up later: `defaultIdleTTL` in [Lifetimes](/lifetimes#keeping-atoms-alive) (a number of milliseconds, where `Atom.setIdleTTL` takes a duration), and `revalidateOnHydrate` in [Hydration](/hydration#running-again-after-hydration). [RegistryProvider](/reference#RegistryProvider) in the API reference lists them all. The provider reads its props once, when it creates the registry: changing `initialValues` or another prop later doesn't change the registry or create a new one.

To provide a registry from a component's script instead of its markup, call `provideRegistry` with the same options. It returns the registry.

## Plain Svelte (no SvelteKit)

effect-atom-svelte doesn't depend on SvelteKit. Only `effect-atom-svelte/sveltekit`, which formats errors for SvelteKit's `handleError` hook, is specific to it, and you can leave it out. Without SvelteKit:

- **Async mode.** Pass `compilerOptions: { experimental: { async: true } }` to `svelte()` from `@sveltejs/vite-plugin-svelte`.
- **The registry.** Wrap your root component's markup in `RegistryProvider`, as you would the root layout.
- **Server rendering.** Await `render` from `svelte/server`: it waits for the async work in your components, then returns the page's `head` and `body`. The results for [hydration](/hydration) are written into `head`, so put it in the page's `<head>`. In the browser, start the app with `hydrate` from `svelte` instead of `mount`.

A client-only app needs none of the server rendering setup. It still needs async mode for `useAtomSuspense` and `useAtomResult`.
