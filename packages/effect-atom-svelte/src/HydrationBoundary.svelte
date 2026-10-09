<!--
  @component
  Hydrates dehydrated atom state, for example from `Hydration.dehydrate` returned by a remote
  function. Atoms new to the registry, or holding only an initial value nobody has read yet, are
  hydrated before children render; in the browser, atoms that already exist are updated after
  render, so current UI does not jump to the incoming data mid-render. On the server, where nothing
  renders again, and in the browser while it hydrates the server's markup, they are updated at once.
  That needs Svelte's `experimental.async`: without it, the browser can't tell that it is hydrating,
  and atoms that already exist, as one read above the boundary, are updated after the first render.

  With `experimental.async` on, custom server rendering must `await render(...)`, as SvelteKit does,
  so the boundary's `hydratable` entry is written into the page. Otherwise a production build of
  Svelte logs `hydratable_missing_but_expected` once per boundary as the page hydrates.

  A value for an atom nobody reads waits in the registry until something does. When the boundary
  is destroyed, as at the end of a server render, the values it brought that are still unread are
  dropped, as is a promise-encoded value that lands afterwards, so a registry that outlives the
  boundary doesn't hand them to a later reader. In the browser, a reader that already held the atom
  when the boundary ended and still holds it, as a layout's reader above it, gets the late value.

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
  import type { AtomRegistry } from "effect/reactivity";
  import { BROWSER } from "esm-env";
  import { hydratable } from "svelte";
  import type { Snippet } from "svelte";

  import { holdsInitialValue } from "./internal/nodeInternals.ts";
  import { onRenderEnd } from "./internal/renderEnd.ts";
  import { onTeardownAfterChildren } from "./internal/teardown.svelte.ts";
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
  // Whether the boundary has ended, as at the end of the server render or once the browser destroys
  // it, after which a late promise-encoded value is dropped.
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
  // The keys of the promise-encoded values the boundary is waiting for.
  const waiting = new Set<string>();
  // In the browser, the node that held each of those keys when the boundary ended. That node, as a
  // layout's reader above the boundary that took its waiting value, still needs the result, or it
  // waits forever. A node a later reader creates doesn't get it, nor does one that replaced a node
  // swept since, as a reader inside the boundary's is just after it ends.
  const nodesAtEnd = new Map<string, AtomRegistry.Node<unknown>>();
  /** A promise-encoded value as the boundary waits for it; one landing after the boundary ends is skipped. */
  const lateDropped = async (
    key: string,
    late: Promise<unknown>
  ): Promise<unknown> => {
    waiting.add(key);
    const value = await late;
    if (!ended) {
      return value;
    }
    const held = BROWSER ? nodesAtEnd.get(key) : undefined;
    return held !== undefined && registry.getNodes().get(key) === held
      ? value
      : skipped;
  };

  const queue = (atoms: readonly Hydration.DehydratedAtomValue[]): void => {
    // A promise-encoded value landing after the boundary has ended, after the server render or once
    // the browser has navigated away, would stay queued in a registry that outlives it for a later
    // reader, however late: it is ignored once the boundary ends, unless, in the browser, the node
    // that held its key then still does.
    Hydration.hydrate(
      registry,
      atoms.map((atom) =>
        atom.resultPromise === undefined
          ? atom
          : {
              ...atom,
              resultPromise: lateDropped(atom.key, atom.resultPromise),
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

  /**
   * Whether a node's value may be on the page already. A node holding only an initial value nobody
   * has read, as RegistryProvider's initialValues leave it, shows nowhere yet: it takes the incoming
   * value before children render, as on the server, so the browser's first render matches the
   * server's markup.
   */
  const shown = (node: AtomRegistry.Node<unknown> | undefined): boolean =>
    node !== undefined &&
    !(holdsInitialValue(node) && node.currentState() === "stale");

  const hydrateNew = (
    incoming: Iterable<Hydration.DehydratedAtom> | undefined
  ): Hydration.DehydratedAtomValue[] => {
    const nodes = registry.getNodes();
    const fresh: Hydration.DehydratedAtomValue[] = [];
    const existing: Hydration.DehydratedAtomValue[] = [];
    for (const atom of Hydration.toValues([...(incoming ?? [])])) {
      (shown(nodes.get(atom.key)) ? existing : fresh).push(atom);
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
  // exist are updated now, before the children read them. The browser does the same while it
  // hydrates the server's markup, so its first render matches the server's. The server writes true;
  // the browser reads it only while hydrating, and false otherwise. hydratable throws in development
  // for a key the server didn't write, as for a boundary the server didn't render: that is false too.
  const hydratingServerMarkup = (() => {
    try {
      return hydratable("effect-atom-svelte/HydrationBoundary", () => !BROWSER);
    } catch {
      return false;
    }
  })();
  if (!BROWSER || hydratingServerMarkup) {
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
  // a failed boundary discarded this one; in the browser, also when it is destroyed while pending.
  (BROWSER ? onTeardownAfterChildren : onRenderEnd)(() => {
    if (ended) {
      return;
    }
    ended = true;
    if (BROWSER) {
      const nodes = registry.getNodes();
      for (const key of waiting) {
        const node = nodes.get(key);
        if (node) {
          nodesAtEnd.set(key, node);
        }
      }
    }
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
