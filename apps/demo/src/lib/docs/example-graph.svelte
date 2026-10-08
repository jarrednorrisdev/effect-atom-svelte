<!--
  @component
  The live dependency graph at the top of a docs example: the atoms the example's components use
  (and those upstream of them), and the components themselves, read from the example's inspector
  scope and drawn by the devtools package's graph (effect-atom-svelte-devtools/graph), as the
  devtools panel draws the whole registry. It follows the example as it runs: a node rings when its
  value updates, in green for a Success and red for a Failure, and an interrupted atom shows a cross.

  ```svelte
  <ExampleGraph {scope} />
  ```
-->
<script lang="ts">
  import { getRegistry } from "effect-atom-svelte";
  import type {
    InspectorScope,
    ScopeEdge,
    ScopeNode,
    ScopeSnapshot,
  } from "effect-atom-svelte/inspector";
  import { AtomGraph, toneOf } from "effect-atom-svelte-devtools/graph";
  import type { GraphInput } from "effect-atom-svelte-devtools/graph";
  import { onMount, tick } from "svelte";

  /**
   * `expected`: whether the example's code uses atoms at all. If not, there's no strip, unless atoms
   * turn up in the scope anyway; if so, the strip keeps its place before they do.
   */
  const { expected = true, scope }: { expected?: boolean; scope: InspectorScope } = $props();

  const registry = getRegistry();

  let snapshot = $state.raw<ScopeSnapshot>();
  /**
   * Atoms that have left the scope (nothing in the example reads them now) but that the registry
   * still holds, a keepAlive atom or one waiting out its idle TTL, and, briefly, ones it has just
   * removed. The scope only follows what the example's hooks use, so the graph keeps these itself.
   */
  let lingering = $state.raw<readonly { node: ScopeNode; removed: boolean }[]>([]);
  let lingeringEdges = $state.raw<readonly ScopeEdge[]>([]);
  let graph = $state<AtomGraph>();
  // The server renders the strip empty; only once the scope is read does "nothing yet" mean it.
  let mounted = $state(false);

  onMount(() => {
    // The scope calls its listeners in the middle of the registry's work, where reading atoms or
    // writing Svelte state isn't safe: note what happened, and act on the next frame.
    const pulses = new Set<number>();
    const interrupts = new Set<number>();
    let stale = false;
    let frame = 0;

    // What the last snapshot held, what has left the scope but lives on, what's just been removed
    // (shown with a cross until then), and every edge seen, to draw between those.
    let previous = new Map<number, ScopeNode>();
    const held = new Map<number, ScopeNode>();
    const removed = new Map<number, { node: ScopeNode; until: number }>();
    const seenEdges = new Map<string, ScopeEdge>();

    const refresh = () => {
      const next = scope.snapshot();
      const now = performance.now();
      const present = new Set(next.nodes.map((node) => node.id));
      const alive = new Set<unknown>(registry.getNodes().values());
      for (const edge of next.edges) {
        seenEdges.set(`${edge.from}>${edge.to}`, edge);
      }
      for (const [id, node] of [...previous, ...held]) {
        if (present.has(id)) {
          held.delete(id);
        } else if (alive.has(node.node)) {
          held.set(id, node);
        } else {
          held.delete(id);
          if (!removed.has(id)) {
            removed.set(id, { node, until: now + 1600 });
          }
        }
      }
      for (const [id, entry] of removed) {
        if (present.has(id) || entry.until < now) {
          removed.delete(id);
        }
      }
      previous = new Map(next.nodes.map((node) => [node.id, node]));
      snapshot = next;
      lingering = [
        ...[...held.values()].map((node) => ({ node, removed: false })),
        ...[...removed.values()].map(({ node }) => ({ node, removed: true })),
      ];
      lingeringEdges = [...seenEdges.values()];
    };

    const flush = async () => {
      frame = 0;
      if (stale) {
        stale = false;
        refresh();
        await tick();
      }
      // A pulse takes the tone of the value it brought: green for a Success, red for a Failure,
      // the accent for anything else (a plain value, or a result still waiting for the next one).
      const nodes = new Map(snapshot?.nodes.map((node) => [node.id, node]));
      for (const id of pulses) {
        const node = nodes.get(id);
        graph?.pulse(id, toneOf(node?.state, node?.waiting));
      }
      for (const id of interrupts) {
        graph?.interrupt(id);
      }
      pulses.clear();
      interrupts.clear();
    };

    const run = async () => {
      try {
        await flush();
      } catch (error) {
        reportError(error);
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(run);
    };

    const unsubscribe = scope.subscribe((event) => {
      if (event._tag === "ScopeChanged") {
        stale = true;
      } else if (event._tag === "Updated") {
        // A new value can change a node's note (Success, waiting) as well as ringing it.
        stale = true;
        pulses.add(event.id);
      } else if (event._tag === "Interrupted") {
        interrupts.add(event.id);
      }
      schedule();
    });
    refresh();
    mounted = true;
    // The registry removes an idle atom on a timer, with nothing in the scope to say so: while any
    // atom lingers, look again twice a second.
    const timer = setInterval(() => {
      if (held.size > 0 || removed.size > 0) {
        stale = true;
        schedule();
      }
    }, 500);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  });

  /** A file's name without its folders: what the example's code tabs call it. */
  const basename = (file: string) => file.split(/[\\/]/u).at(-1) ?? file;

  /** What an atom's note says: its result, if it holds one, and whether it's waiting. */
  const noteOf = (node: ScopeNode) =>
    node.state === "Value"
      ? undefined
      : [node.state, node.waiting && "waiting"].filter(Boolean).join(" · ");

  /** What a lingering atom's note says: why the registry still holds it, or that it's gone. */
  const lingerNote = (node: ScopeNode, removed: boolean) => {
    if (removed) {
      return "removed";
    }
    if (node.atom.keepAlive) {
      return "no readers · kept alive";
    }
    return node.atom.idleTTL === undefined ? "no readers" : "no readers · idle, removed soon";
  };

  // The scope, and what lingers from it, as the shared graph takes it.
  const input = $derived.by((): GraphInput | undefined => {
    if (!snapshot || snapshot.nodes.length + lingering.length === 0) {
      return undefined;
    }
    const present = new Set(snapshot.nodes.map((node) => node.id));
    return {
      atoms: [
        ...snapshot.nodes.map((node) => ({ id: node.id, label: node.label, note: noteOf(node) })),
        ...lingering
          .filter(({ node }) => !present.has(node.id))
          .map(({ node, removed }) => ({
            id: node.id,
            label: node.label,
            note: lingerNote(node, removed),
            status: removed ? ("removed" as const) : ("held" as const),
          })),
      ],
      links: [...lingeringEdges, ...snapshot.edges],
      readers: snapshot.readers.map((reader) => ({
        atom: reader.atom,
        instance: reader.instance,
        kind: reader.kind,
        name: reader.file ? basename(reader.file) : (reader.component ?? "component"),
      })),
    };
  });
</script>

<!-- At least one row tall whenever the example uses atoms, so it doesn't jump when they appear.
     Hidden from screen readers: it draws what the example's code says. -->
{#if input || expected}
  <div aria-hidden="true" class="example-graph">
    {#if input}
      <AtomGraph bind:this={graph} graph={input} />
    {:else if mounted}
      <p class="docs-label empty">No atom is in use yet</p>
    {/if}
  </div>
{/if}

<style>
  /* Across the result's full width, ruled off from the result below it. */
  .example-graph {
    /* The result's own tint (example.svelte, .demo), behind the labels. */
    --graph-background: color-mix(in oklab, var(--brand) 4%, var(--background));
    border-bottom: 1px solid var(--border);
    margin: -0.75rem -1.5rem 1rem;
    min-height: 3.5rem;
    position: relative;
  }
  .empty {
    bottom: 1rem;
    left: 1.5rem;
    margin: 0;
    position: absolute;
  }
  @media (width < 48rem) {
    .example-graph {
      display: none;
    }
  }
</style>
