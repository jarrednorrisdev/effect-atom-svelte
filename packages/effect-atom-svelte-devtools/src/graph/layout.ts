// Where a dependency graph draws its atoms and components, on a frame's lines (frame-graph.svelte).
//
// Atoms sit in columns by how far they are from a source; the components that read them, if any,
// in a column of their own at 72%. Rows are tracks, as on the docs site's landing page: each source
// starts one, and a derived atom stays on its parent's track where it can, so most edges run
// straight. An edge that changes track turns between columns; into a component it gathers on a
// collector; through a node it goes round along a lane of its own; and where it crosses another
// edge's line, that line breaks, so a crossing doesn't read as a junction. A family's or factory's
// atoms, named `draftAtom(…)` by the atomLabels plugin, share a row of dots when there are three or
// more and only one is read at a time.
import type { GraphEdge, GraphNode } from "./frame-graph.svelte";

/** An atom to draw. */
export interface GraphAtom {
  /** Stable for the atom, and in the order it was first seen: the layout keeps that order. */
  readonly id: number;
  readonly label: string | undefined;
  /** The line under its name: its result, or why it's still held. */
  readonly note?: string | undefined;
  /** Still held but read by nothing in view (`held`), or just removed (`removed`, drawn crossed). */
  readonly status?: "live" | "held" | "removed" | undefined;
  /** Read by something, when there are no component readers to say so (the devtools panel). */
  readonly read?: boolean | undefined;
}

/** That `to` reads `from`. */
export interface GraphLink {
  readonly from: number;
  readonly to: number;
}

/** A component's use of an atom. */
export interface GraphReader {
  readonly atom: number;
  readonly kind: "read" | "mount" | "subscribe" | "write" | (string & {});
  /** The component, as its file is called (`die.svelte`). */
  readonly name: string;
  /** Tells two instances of one component apart. */
  readonly instance?: number | undefined;
}

export interface GraphInput {
  readonly atoms: readonly GraphAtom[];
  readonly links: readonly GraphLink[];
  readonly readers?: readonly GraphReader[] | undefined;
}

/** A family's or factory's atom, drawn as a dot on its group's row. */
export interface GraphDot {
  readonly id: number;
  /** Its key, short: an object's values (`1 · en`) or the argument as written. */
  readonly key: string;
  /** Its full name, for its title. */
  readonly label: string;
  /** A second atom for a key the group already has. */
  readonly repeat: boolean;
  readonly read: boolean;
  readonly removed: boolean;
  readonly x: number;
  readonly y: number;
}

export interface GraphLayout {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly dots: readonly { readonly dots: readonly GraphDot[]; readonly keys: boolean }[];
  readonly height: number;
}

// The first line, and the space between rows: room for a two-line label above each.
const top = 40;
const row = 38;
// The extra a row of dots needs below it for their keys.
const keyRoom = 26;

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

interface Group {
  readonly name: string;
  readonly keys: number;
  readonly dots: readonly { id: number; key: string; label: string; repeat: boolean }[];
}

interface Component {
  readonly key: string;
  readonly label: string;
  readonly uses: Map<number, Set<string>>;
  count: number;
}

/**
 * Lays a graph out for a box `width` pixels wide (only the gaps at crossings depend on it: x is a
 * fraction of the width, y is in pixels). Returns undefined when there's nothing to draw.
 */
export const layoutGraph = (input: GraphInput, width: number): GraphLayout | undefined => {
  if (input.atoms.length === 0) {
    return undefined;
  }
  const readers = input.readers ?? [];
  // In the order they were first seen (ids count up), so an atom keeps its place and its number.
  const atoms = new Map(input.atoms.toSorted((a, b) => a.id - b.id).map((atom) => [atom.id, atom]));
  const status = new Map(input.atoms.map((atom) => [atom.id, atom.status ?? "live"]));
  const readNow = new Set([
    ...readers.map((reader) => reader.atom),
    ...input.atoms.filter((atom) => atom.read).map((atom) => atom.id),
  ]);

  // Groups: the first member stands for the group in the layout; `canon` maps each member to it.
  const canon = new Map<number, number>();
  const groups = new Map<number, Group>();
  const byName = new Map<string, { id: number; args: string }[]>();
  for (const atom of atoms.values()) {
    const match = /^([^(]+)\((.*)\)$/su.exec(atom.label ?? "");
    if (match) {
      const [, name, args] = match as unknown as [string, string, string];
      byName.set(name, [...(byName.get(name) ?? []), { args, id: atom.id }]);
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
  for (const link of input.links) {
    const [from, to] = [canonical(link.from), canonical(link.to)];
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

  // What each component instance does with each atom. Instances of one component that use the
  // same atoms the same way are one node with a count: `card.svelte ×3`.
  const instances = new Map<string, Component>();
  for (const reader of readers.map((r) => ({ ...r, atom: canonical(r.atom) }))) {
    if (!atoms.has(reader.atom)) {
      continue;
    }
    const key = `${reader.name}#${reader.instance ?? 0}`;
    const instance = instances.get(key) ?? { count: 1, key, label: reader.name, uses: new Map() };
    instances.set(key, instance);
    instance.uses.set(reader.atom, (instance.uses.get(reader.atom) ?? new Set()).add(reader.kind));
  }
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

  const rows = new Map<string, number>();
  const placed: { key: string; column: number }[] = [];
  let tracks = 0;
  const place = (column: number, key: string, wanted: number | undefined) => {
    const taken = new Set(
      placed.filter((entry) => entry.column === column).map((entry) => rows.get(entry.key))
    );
    let track = wanted ?? tracks;
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
  // a track of its own instead.
  const readDirectly = new Set(
    [...components.values()].flatMap((component) => [...component.uses.keys()])
  );
  const children = new Map<number, number[]>();
  for (const [child, from] of parents) {
    for (const parent of from) {
      children.set(parent, [...(children.get(parent) ?? []), child]);
    }
  }
  // The components that read only one atom sit together as a block from that atom's track down,
  // and the next atom starts below the block.
  const exclusive = new Map<number, Component[]>();
  for (const component of components.values()) {
    if (component.uses.size === 1) {
      const [atom] = component.uses.keys();
      exclusive.set(atom!, [...(exclusive.get(atom!) ?? []), component]);
    }
  }
  // Depth first: a source, then what derives from it, then the next source.
  const visit = (id: number, wanted: number | undefined) => {
    if (rows.has(`a${id}`)) {
      return;
    }
    place(depths.get(id) ?? 0, `a${id}`, wanted);
    const track = rows.get(`a${id}`) ?? 0;
    tracks = Math.max(tracks, track + (exclusive.get(id)?.length ?? 1));
    (children.get(id) ?? []).forEach((child, index) => {
      visit(child, index === 0 && !readDirectly.has(id) ? track : undefined);
    });
  };
  for (const atom of atoms.values()) {
    if ((parents.get(atom.id) ?? []).length === 0) {
      visit(atom.id, undefined);
    }
  }
  // Anything left (a cycle, say) still gets a place.
  for (const atom of atoms.values()) {
    visit(atom.id, undefined);
  }
  for (const [atom, block] of exclusive) {
    const start = rows.get(`a${atom}`) ?? 0;
    block.forEach((component, index) => place(atomColumns, component.key, start + index));
  }
  // Other components take the track of an atom they use, where it's free; the rest go below,
  // grouped by the track they'd have liked.
  const wantedTrack = (component: Component) =>
    firstTrack([...component.uses.keys()].map((a) => `a${a}`));
  const leftover: Component[] = [];
  for (const component of components.values()) {
    if (rows.has(component.key)) {
      continue;
    }
    const wanted = wantedTrack(component);
    const taken = placed.some(
      (entry) => entry.column === atomColumns && rows.get(entry.key) === wanted
    );
    if (wanted === undefined || taken) {
      leftover.push(component);
    } else {
      place(atomColumns, component.key, wanted);
    }
  }
  const order = (component: Component) => wantedTrack(component) ?? Number.POSITIVE_INFINITY;
  for (const component of leftover.toSorted((a, b) => order(a) - order(b))) {
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

  // Two atoms with one name (one atom scoped twice, say) are told apart by a number.
  const names = new Map<string, number>();
  for (const atom of atoms.values()) {
    names.set(atom.label ?? "atom", (names.get(atom.label ?? "atom") ?? 0) + 1);
  }
  const named = new Map<string, number>();
  const nodes: GraphNode[] = [];
  for (const atom of atoms.values()) {
    const { column, x: nx, y } = at(`a${atom.id}`);
    const name = atom.label ?? "atom";
    const index = (named.get(name) ?? 0) + 1;
    named.set(name, index);
    const group = groups.get(atom.id);
    if (group) {
      const repeats = group.dots.filter((dot) => dot.repeat).length;
      const keys = `${group.keys} ${group.keys === 1 ? "key" : "keys"}`;
      nodes.push({
        id: `g${atom.id}`,
        kind: "junction",
        label: `${group.name}(…)`,
        note: `${group.dots.length} atoms for ${keys}${repeats ? ` · ${repeats} repeat a key` : ""}`,
        side: "ne",
        x: nx,
        y,
      });
      continue;
    }
    nodes.push({
      id: `a${atom.id}`,
      kind: status.get(atom.id) === "removed" ? "gone" : "atom",
      label: (names.get(name) ?? 0) > 1 ? `${name} #${index}` : name,
      note: atom.note,
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
      note:
        kinds.has("write") && kinds.size === 1
          ? "writes"
          : kinds.has("write")
            ? "reads, writes"
            : undefined,
      side: "ne",
      x: nx,
      y,
    });
  }

  // Edges. One that changes track turns between its columns at an offset of its source's own, so
  // edges from different sources never share a vertical line; into a component it gathers on a
  // collector (a component reading several atoms has its own; components reading one atom share
  // that atom's trunk); and one that would run through a node goes round along a lane.
  const lastRow = Math.max(...rows.values());
  const sources = new Map<string, number>();
  const collectors = new Map<string, number>();
  const sourceCount = new Set([
    ...[...parents.values()].flat(),
    ...[...components.values()].flatMap((component) => [...component.uses.keys()]),
  ]).size;
  const blocked = (y: number, x1: number, x2: number) =>
    nodes.some(
      (node) => node.y === y && node.x > Math.min(x1, x2) + 1e-6 && node.x < Math.max(x1, x2) - 1e-6
    );
  let lanes = 0;
  const edges: GraphEdge[] = [];
  const route = (from: string, to: string, dashed: boolean, collector = false) => {
    const a = at(from);
    const b = at(to);
    const source = sources.get(from) ?? sources.size;
    sources.set(from, source);
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
  // headed for the same node, the horizontal one breaks for a few pixels either side.
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
    return pieces.map((points, part) => ({ ...edge, id: `${edge.id}~${part}`, points }));
  });

  const height =
    trackY(lastRow) +
    (lanes > 0 ? lanes * row - row / 2 : 0) +
    (dotted.has(lastRow) ? keyRoom : 0) +
    16;
  const dots = [...groups].map(([first, group]) => {
    const { x: start, y } = at(`a${first}`);
    const end = components.size > 0 ? componentColumn - 0.06 : 0.94;
    const step = Math.min(72 / Math.max(width, 1), (end - start - 0.04) / group.dots.length);
    return {
      dots: group.dots.map((dot, index) => ({
        ...dot,
        read: readNow.has(dot.id),
        removed: status.get(dot.id) === "removed",
        x: start + 0.04 + (index + 0.5) * step,
        y,
      })),
      // Each dot's key fits under it only with room to spare; otherwise it's in the dot's title.
      keys: step * Math.max(width, 1) >= 56,
    };
  });

  return { dots, edges: broken, height, nodes };
};
