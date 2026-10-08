<!--
  @component
  Hydrates dehydrated atom state, for example from `Hydration.dehydrate` returned by a remote
  function. Atoms new to the registry are hydrated before children render; in the browser, atoms
  that already exist are updated after render, so current UI does not jump to the incoming data
  mid-render. On the server, where nothing renders again, they are updated at once.

  A value for an atom nobody reads waits in the registry until something does. When the boundary
  is destroyed, as at the end of a server render, the values it brought that are still unread are
  dropped, so a registry that outlives the boundary doesn't hand them to a later reader.

  **Example** (Hydrating the state a load function dehydrated)

  ```svelte
  <script lang="ts">
    import { HydrationBoundary } from "effect-atom-svelte";

    import TodoList from "./todo-list.svelte";

    // `data.state` is `Hydration.dehydrate(registry)`, returned by +page.server.ts.
    const { data } = $props();
  </script>

  <HydrationBoundary state={data.state}>
    <TodoList />
  </HydrationBoundary>
  ```
-->
<script lang="ts">
  import { Hydration } from "effect/reactivity";
  import { BROWSER } from "esm-env";
  import { onDestroy } from "svelte";
  import type { Snippet } from "svelte";

  import { onRenderEnd } from "./internal/renderEnd.ts";
  import { getRegistry } from "./RegistryContext.ts";

  interface Props {
    readonly state?: Iterable<Hydration.DehydratedAtom> | undefined;
    readonly children: Snippet;
  }

  const { children, state }: Props = $props();
  const registry = getRegistry();

  // SAFETY: preloadedSerializable is on the registry implementation, not the interface (Effect
  // 4.0.0). It holds the encoded values Hydration.hydrate queued, until a lookup of the key takes one.
  const { preloadedSerializable: preloaded } = registry as unknown as {
    readonly preloadedSerializable?: Map<string, unknown>;
  };
  // The values this boundary queued, by key, so it can drop the ones nobody took.
  const queued = new Map<string, unknown>();

  const queue = (atoms: readonly Hydration.DehydratedAtomValue[]): void => {
    Hydration.hydrate(registry, atoms);
    for (const { key, value } of atoms) {
      queued.set(key, value);
    }
  };

  const hydrateNew = (
    incoming: Iterable<Hydration.DehydratedAtom> | undefined
  ): Hydration.DehydratedAtomValue[] => {
    const nodes = registry.getNodes();
    const fresh: Hydration.DehydratedAtomValue[] = [];
    const existing: Hydration.DehydratedAtomValue[] = [];
    for (const atom of Hydration.toValues([...(incoming ?? [])])) {
      (nodes.has(atom.key) ? existing : fresh).push(atom);
    }
    queue(fresh);
    return existing;
  };

  const hydrateExisting = (
    existing: readonly Hydration.DehydratedAtomValue[]
  ): void => {
    queue(existing);
    // hydrate only queues values for existing nodes; the registry applies a queued value the next
    // time the node is looked up, so look each one up now to update its subscribers.
    const nodes = registry.getNodes();
    for (const { key } of existing) {
      const node = nodes.get(key);
      if (node) {
        registry.get(node.atom);
      }
    }
  };

  // Read once at init so children render with the new atoms already in place.
  // svelte-ignore state_referenced_locally
  let hydrated = state;
  // svelte-ignore state_referenced_locally
  let deferred = hydrateNew(state);
  // Effects don't run on the server, and nothing there renders again, so the atoms that already
  // exist are updated now, before the children read them.
  if (!BROWSER) {
    hydrateExisting(deferred);
    deferred = [];
  }

  $effect(() => {
    const incoming = state;
    if (incoming !== hydrated) {
      hydrated = incoming;
      deferred = [...deferred, ...hydrateNew(incoming)];
    }
    if (deferred.length > 0) {
      hydrateExisting(deferred);
      deferred = [];
    }
  });

  // A queued value stays in the registry until its key is looked up. With a registry that outlives
  // the boundary, such as one the caller passes to the server's provider, it would reach a later
  // request. Drop the ones still waiting, unless something queued another value since. On the
  // server they're dropped when the render ends, even if a failed boundary discarded this one.
  (BROWSER ? onDestroy : onRenderEnd)(() => {
    if (!preloaded) {
      return;
    }
    for (const [key, value] of queued) {
      if (preloaded.get(key) === value) {
        preloaded.delete(key);
      }
    }
  });
</script>

{@render children()}
