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
  import { getRegistry } from "effect-atom-svelte";
  import type {
    InspectorScope,
    ScopeEdge,
    ScopeNode,
    ScopeSnapshot,
  } from "effect-atom-svelte/inspector";
  import { onMount, tick } from "svelte";

  import FrameGraph from "./kit/frame-graph.svelte";
  import type { GraphEdge, GraphNode } from "./kit/frame-graph.svelte";

  const { scope }: { scope: InspectorScope } = $props();

  const registry = getRegistry();

  let snapshot = $state.raw<ScopeSnapshot>();
  /**
   * Atoms that have left the scope (nothing in the example reads them now) but that the registry
   * still holds, a keepAlive atom or one waiting out its idle TTL, and, briefly, ones it has just
   * removed. The scope only follows what the example's hooks use, so the graph keeps these itself.
   */
  let lingering = $state.raw<readonly { node: ScopeNode; removed: boolean }[]>([]);
  let lingeringEdges = $state.raw<readonly ScopeEdge[]>([]);
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
    refresh();
    mounted = true;
    // The registry removes an idle atom on a timer, with nothing in the scope to say so: while any
    // atom lingers, look again twice a second.
    const timer = setInterval(() => {
      if (held.size > 0 || removed.size > 0) {
        stale = true;
        frame ||= requestAnimationFrame(() => void flush());
      }
    }, 500);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  });

  /** A family's or factory's atoms on one row (see the layout). */
  interface Group {
    readonly name: string;
    readonly keys: number;
    readonly dots: readonly { id: number; key: string; label: string; repeat: boolean }[];
  }

  /** A key as a dot's caption: an object's values (`1 · en`), or the argument as written. */
  const keyOf = (args: string) => {
    try {
      const value: unknown = JSON.parse(args);
      if (value && typeof value === "object") {
        return Object.values(value).map(String).join(" · ");
      }
      return String(value);
    } catch {
      return args;
    }
  };

  /** A file's name without its folders: what the example's code tabs call it. */
  const basename = (file: string) => file.split(/[\\/]/).at(-1) ?? file;

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

  // The first line, and the space between rows: room for a two-line label above each.
  const top = 40;
  const row = 38;
  // The extra a row of dots needs below it for their keys.
  const keyRoom = 26;

  /**
   * Lays the snapshot out on the line: atoms in columns by how far they are from a source, then the
   * components in a last column. Nodes that share a column stack in rows below the first, and an
   * edge between rows turns halfway between its columns.
   */
  const layout = $derived.by(() => {
    if (!snapshot || snapshot.nodes.length + lingering.length === 0) {
      return undefined;
    }
    const current = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const left = new Map<number, boolean>();
    for (const { node, removed } of lingering) {
      if (!current.has(node.id)) {
        current.set(node.id, node);
        left.set(node.id, removed);
      }
    }
    // In the order the scope first saw them (ids count up), so an atom keeps its place and its
    // number (atom #2) however the example's reads move between atoms.
    const atoms = new Map([...current].toSorted(([a], [b]) => a - b));

    // A family's or factory's atoms (named `draftAtom(…)` by the atomLabels plugin) share a row of
    // dots when there are three or more of them and the example reads one at a time: a dot per
    // atom, its key under it, so a key that gets a second atom stands out. The group's first atom
    // stands for it in the layout; `canon` maps each member to it.
    const canon = new Map<number, number>();
    const groups = new Map<number, Group>();
    const readNow = new Set(snapshot.readers.map((reader) => reader.atom));
    const byName = new Map<string, { id: number; args: string }[]>();
    for (const node of atoms.values()) {
      const match = /^([^(]+)\((.*)\)$/su.exec(node.label ?? "");
      if (match) {
        const [, name, args] = match as unknown as [string, string, string];
        byName.set(name, [...(byName.get(name) ?? []), { args, id: node.id }]);
      }
    }
    for (const [name, members] of byName) {
      if (members.length < 3 || members.filter(({ id }) => readNow.has(id)).length > 1) {
        continue;
      }
      const first = members[0]!.id;
      const seenKeys = new Set<string>();
      groups.set(first, {
        dots: members.map(({ args, id }) => {
          const repeat = seenKeys.has(args);
          seenKeys.add(args);
          return { id, key: keyOf(args), label: `${name}(${args})`, repeat };
        }),
        keys: seenKeys.size,
        name,
      });
      for (const { id } of members) {
        canon.set(id, first);
        if (id !== first) {
          atoms.delete(id);
        }
      }
    }
    const canonical = (id: number) => canon.get(id) ?? id;

    const parents = new Map<number, number[]>();
    // The edges between what's left keep the last shape the scope saw.
    const allEdges = new Map(
      [...lingeringEdges, ...snapshot.edges].map((edge) => [`${edge.from}>${edge.to}`, edge])
    );
    for (const edge of allEdges.values()) {
      const [from, to] = [canonical(edge.from), canonical(edge.to)];
      if (from !== to && atoms.has(from) && atoms.has(to) && !parents.get(to)?.includes(from)) {
        parents.set(to, [...(parents.get(to) ?? []), from]);
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
    for (const reader of snapshot.readers.map((r) => ({ ...r, atom: canonical(r.atom) }))) {
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
    // The components that read only one atom sit together as a block from that atom's track down,
    // and the next atom starts below the block: an atom and what fans out from it read as one unit.
    const exclusive = new Map<number, Component[]>();
    for (const component of components.values()) {
      if (component.uses.size === 1) {
        const [atom] = component.uses.keys();
        exclusive.set(atom!, [...(exclusive.get(atom!) ?? []), component]);
      }
    }
    const visit = (id: number, wanted: number | undefined) => {
      if (rows.has(`a${id}`)) {
        return;
      }
      place(depths.get(id) ?? 0, `a${id}`, wanted);
      const track = rows.get(`a${id}`);
      tracks = Math.max(tracks, (track ?? 0) + (exclusive.get(id)?.length ?? 1));
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
    for (const [atom, block] of exclusive) {
      const start = rows.get(`a${atom}`) ?? 0;
      block.forEach((component, index) => place(atomColumns, component.key, start + index));
    }
    const leftover: Component[] = [];
    for (const component of components.values()) {
      if (rows.has(component.key)) {
        continue;
      }
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
    // A row of dots has its keys under it: every track after one moves down to make room.
    const dotted = new Set([...groups.keys()].map((first) => rows.get(`a${first}`) ?? 0));
    const trackY = (track: number) =>
      top + track * row + [...dotted].filter((t) => t < track).length * keyRoom;
    const at = (key: string) => {
      const column = placed.find((entry) => entry.key === key)?.column ?? 0;
      return { column, x: x(column), y: trackY(rows.get(key) ?? 0) };
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
      const group = groups.get(node.id);
      if (group) {
        const repeats = group.dots.filter((dot) => dot.repeat).length;
        nodes.push({
          id: `g${node.id}`,
          kind: "junction",
          label: `${group.name}(…)`,
          note: `${group.dots.length} atoms for ${group.keys} ${group.keys === 1 ? "key" : "keys"}${repeats ? ` · ${repeats} repeat a key` : ""}`,
          side: "ne",
          x: nx,
          y,
        });
        continue;
      }
      const gone = left.get(node.id);
      nodes.push({
        id: `a${node.id}`,
        kind: gone ? "gone" : "atom",
        label: (names.get(name) ?? 0) > 1 ? `${name} #${index}` : name,
        note: gone === undefined ? noteOf(node) : lingerNote(node, gone),
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
      const lane = trackY(lastRow + 1 + lanes) - row / 2;
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

    const height =
      trackY(lastRow) + (lanes > 0 ? lanes * row - row / 2 : 0) + (dotted.has(lastRow) ? keyRoom : 0) + 16;
    const rowsOfDots = [...groups].map(([first, group]) => {
      const { x: start, y } = at(`a${first}`);
      const end = components.size > 0 ? componentColumn - 0.06 : 0.94;
      const step = Math.min(72 / Math.max(width, 1), (end - start - 0.04) / group.dots.length);
      return {
        dots: group.dots.map((dot, index) => ({
          ...dot,
          read: readNow.has(dot.id),
          removed: left.get(dot.id) === true,
          x: start + 0.04 + (index + 0.5) * step,
          y,
        })),
        // Each dot's key fits under it only with room to spare; otherwise it's in the dot's title.
        keys: step * Math.max(width, 1) >= 56,
      };
    });

    return { dots: rowsOfDots, edges: broken, height, nodes };
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
    {#each layout.dots as row, index (index)}
      {#each row.dots as dot (dot.id)}
        <span
          style:left="{dot.x * width}px"
          style:top="{dot.y}px"
          class={["dot", dot.read && "read", dot.repeat && "repeat", dot.removed && "removed"]}
          data-node="a{dot.id}"
          title={dot.label}
        >
          <i></i>
          <b class="ring"></b>
          {#if row.keys}<span class="key">{dot.key}</span>{/if}
        </span>
      {/each}
    {/each}
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
  /*
   * A family's or factory's atoms as dots on its track: hollow while kept alive with no readers,
   * filled while read, crossed once removed, and red when it's a second atom for a key already seen.
   * Odd sizes and whole-pixel borders keep a dot centred on its 1px line (kit/frame-graph.svelte).
   */
  .dot {
    height: 1px;
    position: absolute;
    width: 1px;
    z-index: 3;
  }
  .dot i {
    background: var(--graph-background);
    border: 2px solid var(--brand);
    border-radius: 50%;
    height: 11px;
    left: -5px;
    position: absolute;
    top: -5px;
    width: 11px;
  }
  .dot.read i {
    background: var(--brand);
  }
  .dot.repeat i {
    border-color: var(--tone-failure, #ef4444);
  }
  .dot.repeat.read i {
    background: var(--tone-failure, #ef4444);
  }
  .dot.removed i {
    background:
      linear-gradient(45deg, transparent 42%, var(--brand-text) 42% 58%, transparent 58%),
      linear-gradient(-45deg, transparent 42%, var(--brand-text) 42% 58%, transparent 58%);
    border: 0;
  }
  .key {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    left: 0;
    position: absolute;
    top: 0.6rem;
    translate: -50% 0;
    white-space: nowrap;
  }
  .dot.read .key {
    color: var(--brand-text);
  }
  .dot.repeat .key {
    color: var(--tone-failure-text, #ef4444);
  }
  .dot .ring {
    border: 1.5px solid var(--brand);
    border-radius: 50%;
    height: 11px;
    left: -5px;
    opacity: 0;
    position: absolute;
    top: -5px;
    width: 11px;
  }
  .dot:global(.pulse) .ring {
    animation: dot-ring 0.9s ease-out both;
  }
  @keyframes dot-ring {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 2.6;
    }
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
