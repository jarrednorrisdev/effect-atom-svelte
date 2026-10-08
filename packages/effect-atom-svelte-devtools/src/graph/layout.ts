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

/** A component's use of an atom: `read`, `mount`, `subscribe` or `write`. */
export interface GraphReader {
  readonly atom: number;
  readonly kind: string;
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

/**
 * The tone a value's pulse takes: green for a Success, red for a Failure, and the accent for a
 * plain value or a result still waiting for the next.
 */
export const toneOf = (state: string | undefined, waiting = false): "success" | "failure" | "" => {
  if (waiting) {
    return "";
  }
  if (state === "Success") {
    return "success";
  }
  return state === "Failure" ? "failure" : "";
};

// The first line, and the space between rows: room for a two-line label above each.
const top = 40;
const row = 38;
// The extra a row of dots needs below it for their keys.
const keyRoom = 26;
// Components sit in a column of their own at 72%, with their labels to the right of them.
const componentColumn = 0.72;

type Point = readonly [x: number, y: number];

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

const append = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

/**
 * A family's or factory's atoms on one row: the group's first member stands for it in the layout,
 * and `canon` maps each member to it. Only for three or more members, read one at a time.
 */
const groupFamilies = (atoms: Map<number, GraphAtom>, readNow: ReadonlySet<number>) => {
  const canon = new Map<number, number>();
  const groups = new Map<number, Group>();
  const byName = new Map<string, { id: number; args: string }[]>();
  for (const atom of atoms.values()) {
    const match = /^(?<name>[^(]+)\((?<args>.*)\)$/su.exec(atom.label ?? "");
    if (match?.groups?.name !== undefined && match.groups.args !== undefined) {
      append(byName, match.groups.name, { args: match.groups.args, id: atom.id });
    }
  }
  for (const [name, members] of byName) {
    const [first] = members;
    if (!first || members.length < 3 || members.filter(({ id }) => readNow.has(id)).length > 1) {
      continue;
    }
    const seenKeys = new Set<string>();
    const dots = members.map(({ args, id }) => {
      const repeat = seenKeys.has(args);
      seenKeys.add(args);
      return { id, key: keyOf(args), label: `${name}(${args})`, repeat };
    });
    groups.set(first.id, { dots, keys: seenKeys.size, name });
    for (const { id } of members) {
      canon.set(id, first.id);
      if (id !== first.id) {
        atoms.delete(id);
      }
    }
  }
  return { canon, groups };
};

/** Each drawn atom's parents, through the groups. */
const parentsOf = (
  links: readonly GraphLink[],
  atoms: ReadonlyMap<number, GraphAtom>,
  canonical: (id: number) => number
) => {
  const parents = new Map<number, number[]>();
  for (const link of links) {
    const from = canonical(link.from);
    const to = canonical(link.to);
    if (from !== to && atoms.has(from) && atoms.has(to) && !parents.get(to)?.includes(from)) {
      append(parents, to, from);
    }
  }
  return parents;
};

/** How far each atom is from a source: the longest chain of parents above it. */
const depthsOf = (atoms: ReadonlyMap<number, GraphAtom>, parents: ReadonlyMap<number, number[]>) => {
  const depths = new Map<number, number>();
  const depth = (id: number, seen: Set<number>): number => {
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
    depth(id, new Set());
  }
  return depths;
};

/**
 * What each component instance does with each atom; instances of one component that use the same
 * atoms the same way are one node with a count (`card.svelte ×3`).
 */
const componentsOf = (
  readers: readonly GraphReader[],
  atoms: ReadonlyMap<number, GraphAtom>,
  canonical: (id: number) => number
) => {
  const instances = new Map<string, Component>();
  for (const reader of readers) {
    const atom = canonical(reader.atom);
    if (!atoms.has(atom)) {
      continue;
    }
    const key = `${reader.name}#${reader.instance ?? 0}`;
    const instance = instances.get(key) ?? { count: 1, key, label: reader.name, uses: new Map() };
    instances.set(key, instance);
    instance.uses.set(atom, (instance.uses.get(atom) ?? new Set()).add(reader.kind));
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
  return components;
};

/** Where things go: a column and a track for each key (`a<id>` for an atom, a component's key). */
class Tracks {
  readonly rows = new Map<string, number>();
  readonly columns = new Map<string, number>();
  count = 0;

  place(column: number, key: string, wanted: number | undefined): number {
    const taken = new Set(
      [...this.columns].filter(([, at]) => at === column).map(([other]) => this.rows.get(other))
    );
    let track = wanted ?? this.count;
    while (taken.has(track)) {
      track += 1;
    }
    this.rows.set(key, track);
    this.columns.set(key, column);
    this.count = Math.max(this.count, track + 1);
    return track;
  }

  first(keys: readonly string[]): number | undefined {
    const known = keys
      .map((key) => this.rows.get(key))
      .filter((track): track is number => track !== undefined);
    return known.length > 0 ? Math.min(...known) : undefined;
  }
}

interface Shape {
  readonly atoms: ReadonlyMap<number, GraphAtom>;
  readonly parents: ReadonlyMap<number, number[]>;
  readonly depths: ReadonlyMap<number, number>;
  readonly components: ReadonlyMap<string, Component>;
  readonly atomColumns: number;
}

/**
 * Places atoms depth first: a source, then what derives from it, then the next source, so a derived
 * atom sits under its parent. The first child takes its parent's track, unless a component reads the
 * parent, which keeps its track clear to the component; and the components that read only one atom
 * sit together as a block from that atom's track down, the next atom starting below the block.
 */
const placeAtoms = (shape: Shape, tracks: Tracks) => {
  const readDirectly = new Set(
    [...shape.components.values()].flatMap((component) => [...component.uses.keys()])
  );
  const children = new Map<number, number[]>();
  for (const [child, from] of shape.parents) {
    for (const parent of from) {
      append(children, parent, child);
    }
  }
  const exclusive = new Map<number, Component[]>();
  for (const component of shape.components.values()) {
    const [only] = component.uses.keys();
    if (component.uses.size === 1 && only !== undefined) {
      append(exclusive, only, component);
    }
  }
  const visit = (id: number, wanted: number | undefined) => {
    if (tracks.rows.has(`a${id}`)) {
      return;
    }
    const track = tracks.place(shape.depths.get(id) ?? 0, `a${id}`, wanted);
    tracks.count = Math.max(tracks.count, track + (exclusive.get(id)?.length ?? 1));
    for (const [index, child] of (children.get(id) ?? []).entries()) {
      visit(child, index === 0 && !readDirectly.has(id) ? track : undefined);
    }
  };
  for (const atom of shape.atoms.values()) {
    if ((shape.parents.get(atom.id) ?? []).length === 0) {
      visit(atom.id, undefined);
    }
  }
  // Anything left (a cycle, say) still gets a place.
  for (const atom of shape.atoms.values()) {
    visit(atom.id, undefined);
  }
  return exclusive;
};

/**
 * Places components: each block from its atom's track down, then the others on the track of an atom
 * they use where it's free, then the rest below, grouped by the track they'd have liked.
 */
const placeComponents = (shape: Shape, tracks: Tracks, exclusive: Map<number, Component[]>) => {
  for (const [atom, block] of exclusive) {
    const start = tracks.rows.get(`a${atom}`) ?? 0;
    for (const [index, component] of block.entries()) {
      tracks.place(shape.atomColumns, component.key, start + index);
    }
  }
  const wantedTrack = (component: Component) =>
    tracks.first([...component.uses.keys()].map((a) => `a${a}`));
  const leftover: Component[] = [];
  for (const component of shape.components.values()) {
    if (tracks.rows.has(component.key)) {
      continue;
    }
    const wanted = wantedTrack(component);
    const taken = [...tracks.columns].some(
      ([key, column]) => column === shape.atomColumns && tracks.rows.get(key) === wanted
    );
    if (wanted === undefined || taken) {
      leftover.push(component);
    } else {
      tracks.place(shape.atomColumns, component.key, wanted);
    }
  }
  const order = (component: Component) => wantedTrack(component) ?? Number.POSITIVE_INFINITY;
  for (const component of leftover.toSorted((a, b) => order(a) - order(b))) {
    tracks.place(shape.atomColumns, component.key, tracks.count);
  }
};

/** Where on the page a key is drawn: x as a fraction of the width, y in pixels. */
const positions = (shape: Shape, tracks: Tracks, dotted: ReadonlySet<number>) => {
  const hasComponents = shape.components.size > 0;
  const x = (column: number) => {
    if (hasComponents && column === shape.atomColumns) {
      return componentColumn;
    }
    const span = hasComponents ? 0.52 : 0.84;
    return shape.atomColumns === 1 ? 0.04 : 0.04 + (column * (span - 0.04)) / (shape.atomColumns - 1);
  };
  // A row of dots has its keys under it: every track after one moves down to make room.
  const trackY = (track: number) =>
    top + track * row + [...dotted].filter((t) => t < track).length * keyRoom;
  const at = (key: string) => {
    const column = tracks.columns.get(key) ?? 0;
    return { column, x: x(column), y: trackY(tracks.rows.get(key) ?? 0) };
  };
  return { at, trackY };
};

type At = ReturnType<typeof positions>["at"];

const groupNode = (id: number, group: Group, x: number, y: number): GraphNode => {
  const repeats = group.dots.filter((dot) => dot.repeat).length;
  const keys = `${group.keys} ${group.keys === 1 ? "key" : "keys"}`;
  return {
    id: `g${id}`,
    kind: "junction",
    label: `${group.name}(…)`,
    note: `${group.dots.length} atoms for ${keys}${repeats > 0 ? ` · ${repeats} repeat a key` : ""}`,
    side: "ne",
    x,
    y,
  };
};

const componentNote = (component: Component) => {
  const kinds = new Set([...component.uses.values()].flatMap((uses) => [...uses]));
  if (!kinds.has("write")) {
    return undefined;
  }
  return kinds.size === 1 ? "writes" : "reads, writes";
};

/** The marks: atoms, groups and components, with labels and notes. */
const nodesOf = (shape: Shape, groups: ReadonlyMap<number, Group>, at: At) => {
  const columns = shape.atomColumns + (shape.components.size > 0 ? 1 : 0);
  // Two atoms with one name (one atom scoped twice, say) are told apart by a number.
  const names = new Map<string, number>();
  for (const atom of shape.atoms.values()) {
    names.set(atom.label ?? "atom", (names.get(atom.label ?? "atom") ?? 0) + 1);
  }
  const named = new Map<string, number>();
  const nodes: GraphNode[] = [];
  for (const atom of shape.atoms.values()) {
    const { column, x, y } = at(`a${atom.id}`);
    const group = groups.get(atom.id);
    if (group) {
      nodes.push(groupNode(atom.id, group, x, y));
      continue;
    }
    const name = atom.label ?? "atom";
    const index = (named.get(name) ?? 0) + 1;
    named.set(name, index);
    const last = shape.components.size === 0 && column === columns - 1 && columns > 1;
    nodes.push({
      id: `a${atom.id}`,
      kind: atom.status === "removed" ? "gone" : "atom",
      label: (names.get(name) ?? 0) > 1 ? `${name} #${index}` : name,
      note: atom.note,
      side: last ? "nw" : "ne",
      x,
      y,
    });
  }
  for (const component of shape.components.values()) {
    const { x, y } = at(component.key);
    nodes.push({
      id: component.key,
      kind: "component",
      label: component.count > 1 ? `${component.label} ×${component.count}` : component.label,
      note: componentNote(component),
      side: "ne",
      x,
      y,
    });
  }
  return nodes;
};

interface Router {
  readonly shape: Shape;
  readonly nodes: readonly GraphNode[];
  readonly at: At;
  readonly trackY: (track: number) => number;
  readonly lastRow: number;
}

/**
 * The edges. One that changes track turns between its columns at an offset of its source's own, so
 * edges from different sources never share a vertical line; into a component it gathers on a
 * collector (a component reading several atoms has its own; components reading one atom share that
 * atom's trunk); and one that would run through a node goes round along a lane of its own.
 */
const routeEdges = ({ at, lastRow, nodes, shape, trackY }: Router) => {
  const sources = new Map<string, number>();
  const collectors = new Map<string, number>();
  const sourceCount = new Set([
    ...[...shape.parents.values()].flat(),
    ...[...shape.components.values()].flatMap((component) => [...component.uses.keys()]),
  ]).size;
  const blocked = (y: number, x1: number, x2: number) =>
    nodes.some(
      (node) => node.y === y && node.x > Math.min(x1, x2) + 1e-6 && node.x < Math.max(x1, x2) - 1e-6
    );
  let lanes = 0;
  const edges: GraphEdge[] = [];

  const turnAt = (from: string, to: string, a: { x: number }, b: { x: number }, collector: boolean) => {
    const source = sources.get(from) ?? sources.size;
    sources.set(from, source);
    if (!collector) {
      return (a.x + b.x) / 2 + (source - (sourceCount - 1) / 2) * 0.018;
    }
    const single = (shape.components.get(to)?.uses.size ?? 0) === 1;
    const owner = single ? `from ${from}` : `into ${to}`;
    const index = collectors.get(owner) ?? collectors.size;
    collectors.set(owner, index);
    return b.x - 0.025 - index * 0.016;
  };

  const route = (from: string, to: string, dashed: boolean, collector = false) => {
    const a = at(from);
    const b = at(to);
    const middle = turnAt(from, to, a, b, collector && a.y !== b.y);
    const same = a.y === b.y;
    const direct: Point[] = same
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
    const through = same
      ? blocked(a.y, a.x, b.x)
      : blocked(a.y, a.x, middle) || blocked(b.y, middle, b.x);
    if (!through) {
      edges.push({ dashed, id: `${from}>${to}`, points: direct, to });
      return;
    }
    const lane = trackY(lastRow + 1 + lanes) - row / 2;
    lanes += 1;
    const gap = 0.015;
    edges.push({
      dashed,
      id: `${from}>${to}`,
      points: [
        [a.x, a.y],
        [a.x + gap, a.y],
        [a.x + gap, lane],
        [b.x - gap, lane],
        [b.x - gap, b.y],
        [b.x, b.y],
      ],
      to,
    });
  };

  for (const [child, from] of shape.parents) {
    for (const parent of from) {
      route(`a${parent}`, `a${child}`, false);
    }
  }
  for (const component of shape.components.values()) {
    for (const [atom, kinds] of component.uses) {
      // An atom the component only writes to: dashed, since nothing flows back to it.
      route(`a${atom}`, component.key, kinds.size === 1 && kinds.has("write"), true);
    }
  }
  return { edges, lanes };
};

/** An edge's runs, as pairs of points. */
const runsOf = (points: readonly Point[]): [Point, Point][] =>
  points.slice(1).flatMap((end, index) => {
    const start = points[index];
    return start ? [[start, end] as [Point, Point]] : [];
  });

/**
 * Where one edge's vertical run crosses the middle of another's horizontal one, and they're not
 * headed for the same node, the horizontal one breaks for a few pixels either side: a crossing reads
 * as passing over, not as a junction. Where lines join, one ends on the other, so they never meet
 * this test.
 */
const breakCrossings = (edges: readonly GraphEdge[], width: number): GraphEdge[] => {
  const half = width > 0 ? 4 / width : 0;
  if (half === 0) {
    return [...edges];
  }
  const verticals = edges.flatMap((edge) =>
    runsOf(edge.points).flatMap(([[x1, y1], [x2, y2]]) =>
      x1 === x2 && y1 !== y2 ? [{ to: edge.to, x: x1, y1: Math.min(y1, y2), y2: Math.max(y1, y2) }] : []
    )
  );
  return edges.flatMap((edge) => {
    const [start] = edge.points;
    if (!start) {
      return [];
    }
    const pieces: Point[][] = [[start]];
    for (const [[x1, y1], [x2, y2]] of runsOf(edge.points)) {
      if (y1 === y2) {
        const forward = x2 > x1;
        const crossings = verticals
          .filter((v) => v.to !== edge.to && y1 > v.y1 && y1 < v.y2)
          .map((v) => v.x)
          .filter((vx) => vx > Math.min(x1, x2) + half && vx < Math.max(x1, x2) - half)
          .toSorted((a, b) => (forward ? a - b : b - a));
        const toward = forward ? -1 : 1;
        for (const vx of crossings) {
          pieces.at(-1)?.push([vx + toward * half, y1]);
          pieces.push([[vx - toward * half, y1]]);
        }
      }
      pieces.at(-1)?.push([x2, y2]);
    }
    return pieces.map((points, part) => ({ ...edge, id: `${edge.id}~${part}`, points }));
  });
};

/** Each group's dots, along its track after its marker, spaced to fit before the components. */
const dotRows = (
  groups: ReadonlyMap<number, Group>,
  at: At,
  hasComponents: boolean,
  readNow: ReadonlySet<number>,
  status: ReadonlyMap<number, GraphAtom["status"]>,
  width: number
) =>
  [...groups].map(([first, group]) => {
    const { x: start, y } = at(`a${first}`);
    const end = hasComponents ? componentColumn - 0.06 : 0.94;
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

/**
 * Lays a graph out for a box `width` pixels wide (only the gaps at crossings and the dots' spacing
 * depend on it: x is a fraction of the width, y is in pixels). Undefined when there's nothing to draw.
 */
export const layoutGraph = (input: GraphInput, width: number): GraphLayout | undefined => {
  if (input.atoms.length === 0) {
    return undefined;
  }
  const readers = input.readers ?? [];
  // In the order they were first seen (ids count up), so an atom keeps its place and its number.
  const atoms = new Map(input.atoms.toSorted((a, b) => a.id - b.id).map((atom) => [atom.id, atom]));
  const status = new Map(input.atoms.map((atom) => [atom.id, atom.status]));
  const readNow = new Set([
    ...readers.map((reader) => reader.atom),
    ...input.atoms.filter((atom) => atom.read === true).map((atom) => atom.id),
  ]);

  const { canon, groups } = groupFamilies(atoms, readNow);
  const canonical = (id: number) => canon.get(id) ?? id;
  const parents = parentsOf(input.links, atoms, canonical);
  const depths = depthsOf(atoms, parents);
  const components = componentsOf(readers, atoms, canonical);
  const shape: Shape = {
    atomColumns: Math.max(...depths.values()) + 1,
    atoms,
    components,
    depths,
    parents,
  };

  const tracks = new Tracks();
  placeComponents(shape, tracks, placeAtoms(shape, tracks));
  const dotted = new Set([...groups.keys()].map((first) => tracks.rows.get(`a${first}`) ?? 0));
  const { at, trackY } = positions(shape, tracks, dotted);
  const nodes = nodesOf(shape, groups, at);
  const lastRow = Math.max(...tracks.rows.values());
  const { edges, lanes } = routeEdges({ at, lastRow, nodes, shape, trackY });

  const height =
    trackY(lastRow) +
    (lanes > 0 ? lanes * row - row / 2 : 0) +
    (dotted.has(lastRow) ? keyRoom : 0) +
    16;
  return {
    dots: dotRows(groups, at, components.size > 0, readNow, status, width),
    edges: breakCrossings(edges, width),
    height,
    nodes,
  };
};
