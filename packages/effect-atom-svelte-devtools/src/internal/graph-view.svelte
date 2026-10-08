<!--
  The registry's live dependency graph, drawn by the graph module as the docs' examples draw theirs
  (../graph): atoms on tracks, a ring in green or red as a value succeeds or fails, a cross when an
  effect is interrupted or an atom removed. Clicking an atom opens its sheet.
-->
<script lang="ts">
  import { AtomGraph, toneOf } from "../graph/index.ts";
  import type { GraphAtom, GraphInput } from "../graph/index.ts";
  import { preview, stateText } from "./format.ts";
  import type { AtomView } from "./model.svelte.ts";
  import { lingerFor } from "./model.svelte.ts";

  interface Props {
    readonly atoms: readonly AtomView[];
    readonly showPlumbing: boolean;
    readonly selected: number | undefined;
    readonly onselect: (id: number) => void;
  }

  const { atoms, onselect, selected, showPlumbing }: Props = $props();

  let graph = $state<AtomGraph>();

  const shown = (view: AtomView) =>
    (showPlumbing || !view.plumbing) &&
    (view.live ||
      (view.removedAt !== undefined && performance.now() - view.removedAt < lingerFor));

  /** Why the registry holds an atom nothing reads. */
  const heldBecause = (view: AtomView) => {
    if (view.keepAlive) {
      return "kept alive";
    }
    return view.idleTTL ? "idle" : "no readers";
  };

  /** Live and read, live but held with nothing reading it, or removed a moment ago. */
  const statusOf = (view: AtomView): GraphAtom["status"] => {
    if (!view.live) {
      return "removed";
    }
    return view.readers > 0 || view.children.length > 0 ? "live" : "held";
  };

  /** Its state and a short preview of its value; why it's still held; or that it's gone. */
  const note = (view: AtomView) => {
    if (!view.live) {
      return "removed · finalizers ran";
    }
    const state = stateText(view.state);
    const value = view.hasValue ? preview(view.value, 26) : "";
    const parts = [state, state === "" || view.state._tag === "Success" ? value : ""];
    if (view.readers === 0 && view.children.length === 0) {
      parts.push(heldBecause(view));
    }
    return parts.filter((part) => part !== "").join(" · ");
  };

  const input = $derived.by((): GraphInput => {
    const byId = new Map(atoms.map((view) => [view.id, view]));
    const visible = atoms.filter(shown);
    const ids = new Set(visible.map((view) => view.id));
    // Through any plumbing that's hidden, to the nearest atoms upstream that are shown.
    const parentsOf = (view: AtomView) => {
      const found = new Set<number>();
      const walk = (from: readonly number[], steps: number) => {
        for (const id of from) {
          if (ids.has(id)) {
            found.add(id);
          } else if (steps < 6) {
            walk(byId.get(id)?.parents ?? [], steps + 1);
          }
        }
      };
      walk(view.parents, 0);
      return found;
    };
    return {
      atoms: visible.map(
        (view): GraphAtom => ({
          id: view.id,
          label: view.name,
          note: note(view),
          read: view.readers > 0,
          status: statusOf(view),
        })
      ),
      links: visible.flatMap((view) => [...parentsOf(view)].map((from) => ({ from, to: view.id }))),
    };
  });

  // How many updates and interruptions each atom had at the last frame: only later ones animate,
  // so opening the panel doesn't set every atom off at once.
  const updates = new Map<number, number>();
  const interruptions = new Map<number, number>();
  $effect(() => {
    for (const view of atoms) {
      const before = updates.get(view.id);
      if (before !== undefined && view.updates > before) {
        const waiting = view.state._tag !== "Value" && view.state.waiting;
        graph?.pulse(view.id, toneOf(view.state._tag, waiting));
      }
      updates.set(view.id, view.updates);
      const interrupted = interruptions.get(view.id);
      if (interrupted !== undefined && view.interruptions > interrupted) {
        graph?.interrupt(view.id);
      }
      interruptions.set(view.id, view.interruptions);
    }
  });
</script>

<div class="graph-view">
  <AtomGraph
    bind:this={graph}
    empty="No atoms in this registry yet. Read one and it appears here."
    graph={input}
    {onselect}
    {selected}
  />
</div>

<style>
  .graph-view {
    padding: 0.25rem 0.5rem 1rem;
  }
</style>
