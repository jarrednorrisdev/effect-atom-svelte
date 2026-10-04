---
title: Installation
description: Install the package, turn on Svelte's async mode and add a registry.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

Setting up takes three steps: install the packages, turn on Svelte's experimental async support, and put a registry at the root of your app.

## Install the packages

effect-atom-svelte needs `effect` alongside it. Atoms come from `effect/reactivity`, which is part of `effect` itself.

```bash
npm install effect effect-atom-svelte
```

<Aside type="caution" title="Not published yet">

The package is pre-release and not on npm yet, so this command does not work today.

</Aside>

The app must load one copy of `effect`. See [Two copies of effect](/troubleshooting#two-copies-of-effect) if a monorepo gives it two.

## Turn on async mode

The async hooks (`useAtomSuspense`, `useAtomResult`) and server rendering depend on Svelte's experimental async support. SvelteKit 3 reads Svelte's options from `vite.config.ts`:

**Example** (Turning on experimental async in SvelteKit 3)

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: { experimental: { async: true } },
    }),
  ],
});
```

Without SvelteKit, pass the same `compilerOptions` to `svelte()` from `@sveltejs/vite-plugin-svelte`.

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

On the server, the provider creates a registry for each request and disposes it when the request has finished rendering. In the browser, one registry lives for the whole session.

<Aside type="danger" title="Always provide a registry when you render on the server">

Without a provider, the browser falls back to a shared default registry, but the server throws `No AtomRegistry in context`. A registry shared at module level on the server would leak one visitor's state into another visitor's page.

</Aside>

### Registry options

Most apps need no options. Two are worth knowing from the start:

| Option | Does |
| --- | --- |
| `initialValues` | Starting values, as `[atom, value]` pairs, such as data from a `load` function. |
| `registry` | An existing registry to provide instead of creating one. You dispose it yourself, and the other options don't apply to it. |

The rest come up later: `defaultIdleTTL` in [Lifetimes](/lifetimes#keeping-atoms-alive) and `revalidateOnHydrate` in [Hydration](/hydration#fetching-again-after-hydration). [RegistryProvider](/reference#RegistryProvider) in the API reference lists them all. The provider reads its props once. Changing them later doesn't create a new registry.

To provide a registry from a component's script instead of its markup, call `provideRegistry` with the same options. It returns the registry.
