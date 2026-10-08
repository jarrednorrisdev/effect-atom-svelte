<!--
  @component
  The live dependency graph at the top of a docs example: the atoms the example's components use
  (and those upstream of them), and the components themselves, read from the example's inspector
  scope. It's drawn like the landing page's graphs, on a hairline (kit/frame-graph.svelte), and it
  follows the example as it runs: a node rings when its value updates, the edges into it flash, and
  an interrupted atom shows a cross.

  ```svelte
  <ExampleGraph {scope} />
  ```
-->
<script lang="ts">
  import type { InspectorScope, ScopeSnapshot } from "effect-atom-svelte/inspector";
  import { onMount, tick } from "svelte";

  import FrameGraph from "./kit/frame-graph.svelte";
  import type { GraphEdge, GraphNode } from "./kit/frame-graph.svelte";

  const { scope }: { scope: InspectorScope } = $props();

  let snapshot = $state.raw<ScopeSnapshot>();
  let host = $state<HTMLElement>();
  // For the gaps at crossings, which are a few pixels wide whatever the graph's width.
  let width = $state(0);
  // The server renders the strip empty; only once the scope is read does "nothing yet" mean it.
  let mounted = $state(false);

  /** Restarts a class's animation on an element. */
  const replay = (element: Element, name: string) => {
    element.classList.remove(name);
    // Reading layout makes the browser see the class come off before it goes back on.
    void (element as HTMLElement).offsetWidth;
    element.classList.add(name);
  };

  onMount(() => {
    // The scope calls its listeners in the middle of the registry's work, where reading atoms or
    // writing Svelte state isn't safe: note what happened, and act on the next frame.
    const pulses = new Set<number>();
    const interrupts = new Set<number>();
    let stale = false;
    let frame = 0;

    const flush = async () => {
      frame = 0;
      if (stale) {
        stale = false;
        snapshot = scope.snapshot();
        await tick();
      }
      for (const id of pulses) {
        const node = host?.querySelector(`[data-node="a${id}"]`);
        if (node) {
          replay(node, "pulse");
        }
        for (const edge of host?.querySelectorAll(`[data-to="a${id}"]`) ?? []) {
          replay(edge, "flash");
        }
      }
      for (const id of interrupts) {
        const node = host?.querySelector(`[data-node="a${id}"]`);
        if (node) {
          replay(node, "interrupted");
        }
      }
      pulses.clear();
      interrupts.clear();
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
      frame ||= requestAnimationFrame(() => void flush());
    });
    snapshot = scope.snapshot();
    mounted = true;
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  });

  /** A file's name without its folders: what the example's code tabs call it. */
  const basename = (file: string) => file.split(/[\\/]/).at(-1) ?? file;

  /** What an atom's note says: its result, if it holds one, and whether it's waiting. */
  const noteOf = (node: ScopeSnapshot["nodes"][number]) =>
    node.state === "Value"
      ? undefined
      : [node.state, node.waiting && "waiting"].filter(Boolean).join(" · ");

  // The first line, and the space between rows: room for a two-line label above each.
  const top = 40;
  const row = 38;

  /**
   * Lays the snapshot out on the line: atoms in columns by how far they are from a source, then the
   * components in a last column. Nodes that share a column stack in rows below the first, and an
   * edge between rows turns halfway between its columns.
   */
  const layout = $derived.by(() => {
    if (!snapshot || snapshot.nodes.length === 0) {
      return undefined;
    }
    const atoms = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const parents = new Map<number, number[]>();
    for (const edge of snapshot.edges) {
      if (atoms.has(edge.from) && atoms.has(edge.to)) {
        parents.set(edge.to, [...(parents.get(edge.to) ?? []), edge.from]);
      }
    }
    const depths = new Map<number, number>();
    const depth = (id: number, seen = new Set<number>()): number => {
      const known = depths.get(id);
      if (known !== undefined) {
        return known;
      }
      seen.add(id);
      const from = (parents.get(id) ?? []).filter((parent) => !seen.has(parent));
      const value = from.length === 0 ? 0 : 1 + Math.max(...from.map((p) => depth(p, seen)));
      depths.set(id, value);
      return value;
    };
    for (const id of atoms.keys()) {
      depth(id);
    }

    // What each component instance does with each atom.
    interface Component {
      readonly key: string;
      readonly label: string;
      readonly uses: Map<number, Set<string>>;
      count: number;
    }
    const instances = new Map<string, Component>();
    for (const reader of snapshot.readers) {
      if (!atoms.has(reader.atom)) {
        continue;
      }
      const name = reader.file ? basename(reader.file) : (reader.component ?? "component");
      const key = `${name}#${reader.instance ?? 0}`;
      const instance = instances.get(key) ?? { count: 1, key, label: name, uses: new Map() };
      instances.set(key, instance);
      instance.uses.set(reader.atom, (instance.uses.get(reader.atom) ?? new Set()).add(reader.kind));
    }
    // Instances of one component that use the same atoms the same way are one node, with a count:
    // three cards reading one log are `card.svelte ×3`, not three lines into three squares.
    const components = new Map<string, Component>();
    for (const instance of instances.values()) {
      const uses = [...instance.uses]
        .map(([atom, kinds]) => `${atom}:${[...kinds].toSorted().join("+")}`)
        .toSorted()
        .join(",");
      const key = `c${instance.label}|${uses}`;
      const known = components.get(key);
      if (known) {
        known.count += 1;
      } else {
        components.set(key, { ...instance, count: 1, key });
      }
    }

    const atomColumns = Math.max(...depths.values()) + 1;
    const columns = atomColumns + (components.size > 0 ? 1 : 0);
    // Components sit in a column of their own at 72%, with their labels to the right of them, so the
    // lines gathering into them run in clear space; atoms spread over what's left.
    const componentColumn = 0.72;
    const x = (column: number) => {
      if (components.size > 0 && column === atomColumns) {
        return componentColumn;
      }
      const span = components.size > 0 ? 0.52 : 0.84;
      return atomColumns === 1 ? 0.04 : 0.04 + (column * (span - 0.04)) / (atomColumns - 1);
    };

    // Tracks (rows), as on the landing page's diagrams: each source starts one, and a node stays on
    // its first parent's track when that's free in its column, so most edges run straight along a
    // track; otherwise it takes the next free one.
    const rows = new Map<string, number>();
    const placed: { key: string; column: number }[] = [];
    let tracks = 0;
    const place = (column: number, key: string, wanted: number | undefined) => {
      const taken = new Set(
        placed.filter((entry) => entry.column === column).map((entry) => rows.get(entry.key))
      );
      let track = wanted;
      if (track === undefined) {
        track = tracks;
      }
      while (taken.has(track)) {
        track += 1;
      }
      rows.set(key, track);
      tracks = Math.max(tracks, track + 1);
      placed.push({ column, key });
    };
    const firstTrack = (keys: readonly string[]) => {
      const known = keys.map((key) => rows.get(key)).filter((track) => track !== undefined);
      return known.length ? Math.min(...known) : undefined;
    };
    // An atom a component reads keeps its track clear to the component: what derives from it starts
    // a track of its own instead of taking that one.
    const readDirectly = new Set(
      [...components.values()].flatMap((component) => [...component.uses.keys()])
    );
    // Depth first: a source, then what derives from it, then the next source, so a derived atom sits
    // just under its parent. Its first child takes the parent's track (unless a component reads the
    // parent), the rest new ones.
    const children = new Map<number, number[]>();
    for (const [child, from] of parents) {
      for (const parent of from) {
        children.set(parent, [...(children.get(parent) ?? []), child]);
      }
    }
    const visit = (id: number, wanted: number | undefined) => {
      if (rows.has(`a${id}`)) {
        return;
      }
      place(depths.get(id) ?? 0, `a${id}`, wanted);
      const track = rows.get(`a${id}`);
      (children.get(id) ?? []).forEach((child, index) => {
        visit(child, index === 0 && !readDirectly.has(id) ? track : undefined);
      });
    };
    for (const node of atoms.values()) {
      if ((parents.get(node.id) ?? []).length === 0) {
        visit(node.id, undefined);
      }
    }
    // Anything left (a cycle, say) still gets a place.
    for (const node of atoms.values()) {
      visit(node.id, undefined);
    }
    // Components first take the track of an atom they use, where it's free, so those reads run
    // straight; the rest go on new tracks below, rather than pushing the others down.
    const leftover: Component[] = [];
    for (const component of components.values()) {
      const wanted = firstTrack([...component.uses.keys()].map((a) => `a${a}`));
      const taken = placed.some(
        (entry) => entry.column === atomColumns && rows.get(entry.key) === wanted
      );
      if (wanted === undefined || taken) {
        leftover.push(component);
      } else {
        place(atomColumns, component.key, wanted);
      }
    }
    // Grouped by the track they'd have liked, so what one atom fans out to stays together.
    const wantedTrack = (component: Component) =>
      firstTrack([...component.uses.keys()].map((a) => `a${a}`)) ?? Number.POSITIVE_INFINITY;
    for (const component of leftover.toSorted((a, b) => wantedTrack(a) - wantedTrack(b))) {
      place(atomColumns, component.key, tracks);
    }
    const at = (key: string) => {
      const column = placed.find((entry) => entry.key === key)?.column ?? 0;
      return { column, x: x(column), y: top + (rows.get(key) ?? 0) * row };
    };

    // Two atoms with one name (one atom scoped twice, say) are told apart by a number too.
    const names = new Map<string, number>();
    for (const node of atoms.values()) {
      names.set(node.label ?? "atom", (names.get(node.label ?? "atom") ?? 0) + 1);
    }
    const named = new Map<string, number>();
    const nodes: GraphNode[] = [];
    for (const node of atoms.values()) {
      const { column, x: nx, y } = at(`a${node.id}`);
      const name = node.label ?? "atom";
      const index = (named.get(name) ?? 0) + 1;
      named.set(name, index);
      nodes.push({
        id: `a${node.id}`,
        kind: "atom",
        label: (names.get(name) ?? 0) > 1 ? `${name} #${index}` : name,
        note: noteOf(node),
        side: components.size === 0 && column === columns - 1 && columns > 1 ? "nw" : "ne",
        x: nx,
        y,
      });
    }
    for (const component of components.values()) {
      const { x: nx, y } = at(component.key);
      const kinds = new Set([...component.uses.values()].flatMap((uses) => [...uses]));
      nodes.push({
        id: component.key,
        kind: "component",
        label: component.count > 1 ? `${component.label} ×${component.count}` : component.label,
        note: kinds.has("write") && kinds.size === 1 ? "writes" : kinds.has("write") ? "reads, writes" : undefined,
        side: "ne",
        x: nx,
        y,
      });
    }

    // An edge that changes track turns halfway between its columns, clear of the labels (which sit
    // beside their nodes), at an offset of its source's own around that line, so edges from
    // different sources never share a vertical line.
    const lastRow = Math.max(...rows.values());
    const sources = new Map<string, number>();
    // Vertical lines into components, none shared by two of them: a component that reads several
    // atoms gathers them on a collector of its own; components that read only one atom share that
    // atom's trunk, which shows what fans out from it.
    const collectors = new Map<string, number>();
    // Every atom with an edge leaving it: from its children, or to the components using it.
    const sourceCount = new Set([
      ...[...parents.values()].flat(),
      ...[...components.values()].flatMap((component) => [...component.uses.keys()]),
    ]).size;
    // Whether a stretch of a row runs through a node other than an edge's own ends.
    const blocked = (y: number, x1: number, x2: number) =>
      nodes.some(
        (node) =>
          node.y === y && node.x > Math.min(x1, x2) + 1e-6 && node.x < Math.max(x1, x2) - 1e-6
      );
    // Lanes below the last row, one for each edge that would otherwise run through a node.
    let lanes = 0;
    const edges: GraphEdge[] = [];
    const route = (from: string, to: string, dashed: boolean, collector = false) => {
      const a = at(from);
      const b = at(to);
      const source = sources.get(from) ?? sources.size;
      sources.set(from, source);
      // Into a component, an atom runs along its own track to a short collector just before the
      // component, then joins it: nothing turns across the atoms in between.
      let middle = (a.x + b.x) / 2 + (source - (sourceCount - 1) / 2) * 0.018;
      if (collector && a.y !== b.y) {
        const single = (components.get(to)?.uses.size ?? 0) === 1;
        const owner = single ? `from ${from}` : `into ${to}`;
        const index = collectors.get(owner) ?? collectors.size;
        collectors.set(owner, index);
        middle = b.x - 0.025 - index * 0.016;
      }
      const direct: [number, number][] =
        a.y === b.y
          ? [
              [a.x, a.y],
              [b.x, b.y],
            ]
          : [
              [a.x, a.y],
              [middle, a.y],
              [middle, b.y],
              [b.x, b.y],
            ];
      const through =
        a.y === b.y ? blocked(a.y, a.x, b.x) : blocked(a.y, a.x, middle) || blocked(b.y, middle, b.x);
      // Through a node, it would read as passing through it: go round, along a lane of its own.
      const lane = top + (lastRow + 1 + lanes) * row - row / 2;
      const gap = 0.015;
      const points: [number, number][] = through
        ? [
            [a.x, a.y],
            [a.x + gap, a.y],
            [a.x + gap, lane],
            [b.x - gap, lane],
            [b.x - gap, b.y],
            [b.x, b.y],
          ]
        : direct;
      if (through) {
        lanes += 1;
      }
      edges.push({ dashed, id: `${from}>${to}`, points, to });
    };
    for (const [child, from] of parents) {
      for (const parent of from) {
        route(`a${parent}`, `a${child}`, false);
      }
    }
    for (const component of components.values()) {
      for (const [atom, kinds] of component.uses) {
        // An atom the component only writes to: dashed, since nothing flows back to it.
        route(`a${atom}`, component.key, kinds.size === 1 && kinds.has("write"), true);
      }
    }

    // Where one edge's vertical run crosses the middle of another's horizontal one, and they're not
    // headed for the same node, the horizontal one breaks for a few pixels either side: a crossing
    // reads as passing over, not as a junction. Where lines join, one ends on the other, so they
    // never meet this test.
    const half = width > 0 ? 4 / width : 0;
    const verticals = edges.flatMap((edge) =>
      edge.points.slice(1).flatMap(([x2, y2], index) => {
        const [x1, y1] = edge.points[index]!;
        return x1 === x2 && y1 !== y2
          ? [{ to: edge.to, x: x1, y1: Math.min(y1, y2), y2: Math.max(y1, y2) }]
          : [];
      })
    );
    const broken: GraphEdge[] = edges.flatMap((edge) => {
      const pieces: (readonly [number, number])[][] = [[edge.points[0]!]];
      edge.points.slice(1).forEach(([x2, y2], index) => {
        const [x1, y1] = edge.points[index]!;
        const piece = pieces.at(-1)!;
        if (y1 === y2 && half > 0) {
          const crossings = verticals
            .filter((v) => v.to !== edge.to && y1 > v.y1 && y1 < v.y2)
            .map((v) => v.x)
            .filter((vx) => vx > Math.min(x1, x2) + half && vx < Math.max(x1, x2) - half)
            .toSorted((a, b) => (x2 > x1 ? a - b : b - a));
          for (const vx of crossings) {
            const toward = x2 > x1 ? -1 : 1;
            piece.push([vx + toward * half, y1]);
            pieces.push([[vx - toward * half, y1]]);
          }
        }
        pieces.at(-1)!.push([x2, y2]);
      });
      return pieces.map((points, part) => ({
        ...edge,
        id: `${edge.id}~${part}`,
        points,
      }));
    });

    const height = top + lastRow * row + (lanes > 0 ? lanes * row - row / 2 : 0) + 16;
    return { edges: broken, height, nodes };
  });
</script>

<!-- Always there, at least one row tall, so the example doesn't jump when its atoms appear. -->
<div
  bind:clientWidth={width}
  bind:this={host}
  class="example-graph"
  style:height={layout ? `${layout.height}px` : undefined}
>
  {#if layout}
    <FrameGraph edges={layout.edges} nodes={layout.nodes} />
  {:else if mounted}
    <p class="docs-label empty">No atom is in use yet</p>
  {/if}
</div>

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
