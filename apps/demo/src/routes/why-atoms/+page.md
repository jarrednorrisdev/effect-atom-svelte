---
title: Why atoms
description: What atoms solve that module state, stores and load functions don't, and when you don't need them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

Svelte 5 already has reactive state that works anywhere: `$state` in a `.svelte.ts` module. This page starts from that, shows where it breaks, and what atoms do about it. It ends with the cases where you don't need atoms at all.

## State shared between components

Say several components need the signed-in user. The shortest way is a module:

**Example** (Module state, set from layout data)

```ts
// user.svelte.ts
export const user = $state({ name: "" });
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { user } from "$lib/user.svelte";

  const { children, data } = $props();
  user.name = data.user.name;
</script>

{@render children()}
```

In the browser this works. On the server it doesn't: a module is loaded once per server process, so every request shares the same `user`. A page that doesn't set it shows whoever was rendered last. With async rendering it is worse, because requests take turns at each `await`: one visitor's render can pick up the name another visitor's request has just set.

### The usual fix, and what it costs

The fix SvelteKit recommends is to keep such state in context, created once per request in the root layout. That isolates requests, but each piece of shared state needs its own context key, its own setup in a layout, and its own getter in every component. Values derived from it, loading and error flags for async data, and cleanup when nothing uses it any more are all left to you.

### With atoms

Atoms make that fix once, for all state. An atom is a description and holds no value, so it can live in a module. Values live in a **registry**, and `RegistryProvider` gives each request its own:

**Example** (The same state as an atom)

```ts
// user.ts
import { Atom } from "effect/reactivity";

export const userAtom = Atom.make({ name: "" });
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";
  import { userAtom } from "$lib/user";

  const { children, data } = $props();
</script>

<RegistryProvider initialValues={[[userAtom, data.user]]}>
  {@render children()}
</RegistryProvider>
```

Any component reads it with `useAtomValue(userAtom)`, with no context key or getter to write. In the browser one registry lasts for the session, so the state is shared exactly as the module version was.

## What else atoms handle

Per-request isolation is the problem a module can't solve. The rest is work you would otherwise write by hand:

- **Async state with loading and errors.** An atom built from an `Effect` holds an `AsyncResult`: `Initial` before the first value, `Success` or `Failure` after, with the error typed by the effect. The hooks hand that to `<svelte:boundary>`, or let you match on it. See [Async atoms](/async-atoms).
- **Derived values.** `Atom.make((get) => ...)` reads other atoms, and the registry recomputes it only when one of them changes. See [Derived atoms](/derived-atoms).
- **Cleanup.** When nothing reads an atom, the registry disposes of it: its effect is interrupted, a stream stops, and finalizers run. A component that unmounts mid-request cancels that request. See [Lifetimes](/lifetimes).
- **Server data in the browser.** Serializable async atoms awaited during server rendering pass their results to the browser, which uses them instead of fetching again. See [Hydration](/hydration).
- **Effect services.** An atom can use services from a `Layer`, and `AtomRpc` and `AtomHttpApi` turn an Effect RPC group or `HttpApi` into typed queries and mutations. See [RPC](/rpc) and [HTTP API](/http).

## Compared with other tools

| Instead of atoms | Good for | What atoms add |
| --- | --- | --- |
| `$state` in a module, or a store | Apps that only render in the browser | Per-request registries on the server, async results, derived values and cleanup |
| `$state` in context | Isolated server state you set up by hand | The same isolation for every atom, without a key, setup or getter per value |
| `load` and remote functions | Data a route needs when it loads | State components share and change afterwards. They combine: pass `load` data to atoms with `initialValues`, as above |
| TanStack Query | Caching server data in apps that don't use Effect | One graph for server data and client state, typed errors and services from Effect |

## When you don't need atoms

- **State one component owns.** A form field or an open menu is `$state` in that component.
- **Apps without Effect.** Atoms are part of Effect. If you don't use Effect and don't plan to, learning it only for shared state costs more than the alternatives above.
- **Route data that doesn't change on the page.** A `load` function is enough.

<Aside type="note">

You can mix them. Components can keep local `$state`, read route data from `load`, and use atoms only for the state they share.

</Aside>
