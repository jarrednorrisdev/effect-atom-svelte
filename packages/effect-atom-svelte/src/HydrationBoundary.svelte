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
<script module lang="ts">
  // Per registry, key and queued value, how many live boundaries queued it. Boundaries given the
  // same state, as a layout and its page might be, queue the same values, and one destroyed first
  // must leave them for the other's children.
  const queuedBy = new WeakMap<object, Map<string, Map<unknown, number>>>();
</script>

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
  // On the server, whether the render has ended, after which a late promise-encoded value is dropped.
  let ended = false;

  const counts =
    queuedBy.get(registry) ?? new Map<string, Map<unknown, number>>();
  queuedBy.set(registry, counts);
  /** Adds one to or takes one from the boundaries queueing a value, and returns the new count. */
  const count = (key: string, value: unknown, delta: 1 | -1): number => {
    const byValue = counts.get(key) ?? new Map<unknown, number>();
    counts.set(key, byValue);
    const next = (byValue.get(value) ?? 0) + delta;
    if (next > 0) {
      byValue.set(value, next);
    } else {
      byValue.delete(value);
      if (byValue.size === 0) {
        counts.delete(key);
      }
    }
    return next;
  };

  // SAFETY: Hydration.hydrate ignores a promise-encoded value that resolves to this marker, which
  // Hydration.ts registers with Symbol.for (Effect 4.0.1) but doesn't export.
  const skipped = Symbol.for("effect/reactivity/Hydration/Skipped");
  /** A promise-encoded value as the server render waits for it; one landing after the render is skipped. */
  const lateDropped = async (late: Promise<unknown>): Promise<unknown> => {
    const value = await late;
    return ended ? skipped : value;
  };

  const queue = (atoms: readonly Hydration.DehydratedAtomValue[]): void => {
    // On the server a promise-encoded value is waited for by the render, but one landing after the
    // render would stay queued in a registry that outlives it: it is ignored once the boundary ends.
    Hydration.hydrate(
      registry,
      BROWSER
        ? atoms
        : atoms.map((atom) =>
            atom.resultPromise === undefined
              ? atom
              : {
                  ...atom,
                  resultPromise: lateDropped(atom.resultPromise),
                }
          )
    );
    for (const { key, value } of atoms) {
      if (queued.has(key)) {
        if (queued.get(key) === value) {
          continue;
        }
        count(key, queued.get(key), -1);
      }
      queued.set(key, value);
      count(key, value, 1);
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
  // request. Drop the ones still waiting, unless something queued another value since or another
  // live boundary queued the same one. On the server they're dropped when the render ends, even if
  // a failed boundary discarded this one.
  (BROWSER ? onDestroy : onRenderEnd)(() => {
    ended = true;
    if (!preloaded) {
      return;
    }
    for (const [key, value] of queued) {
      if (count(key, value, -1) <= 0 && preloaded.get(key) === value) {
        preloaded.delete(key);
      }
    }
  });
</script>

{@render children()}
