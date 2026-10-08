import type {
  BuildCause,
  Event,
  Inspector,
  UpdateSource,
} from "effect-atom-svelte/inspector";
// What the panel shows of a registry, kept up to date from its inspector.
//
// Events arrive in the middle of the registry's work, often inside a Svelte update, so they only
// change plain objects here. A snapshot for the views is published at most once an animation
// frame, outside Svelte's updates: writing Svelte state for every event, as the prototype did,
// set off "Batch has scheduled effects" errors.
import type { Atom, AtomRegistry } from "effect/reactivity";

import { preview, valueState } from "./format.ts";
import type { ValueState } from "./format.ts";
import { identify } from "./names.ts";
import type { Identity } from "./names.ts";

/** An atom as the views show it, at one moment. */
export interface AtomView {
  readonly id: number;
  readonly atom: Atom.Atom<unknown>;
  /** Its label, or a stand-in for an atom without one. */
  readonly name: string;
  readonly identity: Identity;
  /** Made by a library or runtime rather than declared by the app: it has no label. */
  readonly plumbing: boolean;
  readonly keepAlive: boolean;
  readonly idleTTL: number | undefined;
  /** In the registry now; otherwise removed at `removedAt`. */
  readonly live: boolean;
  readonly removedAt: number | undefined;
  readonly readers: number;
  /** The atoms it read in its last computation. */
  readonly parents: readonly number[];
  /** The atoms that read it. */
  readonly children: readonly number[];
  readonly value: unknown;
  readonly hasValue: boolean;
  readonly state: ValueState;
  readonly updates: number;
  readonly builds: number;
  readonly interruptions: number;
  readonly interruptedAt: number | undefined;
}

/** One line of the timeline. */
export interface TimelineEntry {
  readonly seq: number;
  readonly time: number;
  readonly tag: Event["_tag"];
  readonly atom: number;
  /** What happened, in a few words: `todosAtom changed`, `→ 3`. */
  readonly detail: string;
  /** The atoms the detail names, such as the parents that changed. */
  readonly related: readonly number[];
  readonly source: UpdateSource | undefined;
}

/** Counts for the whole registry, for the cover sheet and the launcher. */
export interface Totals {
  readonly atoms: number;
  readonly plumbing: number;
  readonly readers: number;
  readonly builds: number;
  readonly updates: number;
  readonly interruptions: number;
  readonly finalizers: number;
  readonly states: Readonly<Record<string, number>>;
}

interface Entry {
  readonly id: number;
  readonly atom: Atom.Atom<unknown>;
  identity: Identity;
  node: AtomRegistry.Node<unknown> | undefined;
  value: unknown;
  hasValue: boolean;
  updates: number;
  builds: number;
  interruptions: number;
  interruptedAt: number | undefined;
  removedAt: number | undefined;
}

/** How long a removed atom stays in the graph, crossed out, before it goes. */
export const lingerFor = 5000;
const timelineLength = 3000;
const removedKept = 300;

const emptyTotals: Totals = {
  atoms: 0,
  builds: 0,
  finalizers: 0,
  interruptions: 0,
  plumbing: 0,
  readers: 0,
  states: {},
  updates: 0,
};

const causeText = (
  cause: BuildCause,
  nameOf: (node: AtomRegistry.Node<unknown>) => string
): string => {
  switch (cause._tag) {
    case "FirstRead": {
      return "first read";
    }
    case "Refreshed": {
      return "refreshed";
    }
    case "ParentChanged": {
      return `${cause.parents.map(nameOf).join(", ")} changed`;
    }
    default: {
      return "invalidated";
    }
  }
};

export class Model {
  /** Every atom the registry holds, and those removed a moment ago. */
  atoms = $state.raw<readonly AtomView[]>([]);
  timeline = $state.raw<readonly TimelineEntry[]>([]);
  totals = $state.raw<Totals>(emptyTotals);
  /** No atom has a label: the atomLabels plugin isn't installed. */
  unlabelled = $state(false);
  /** The registry isn't the implementation the inspector knows, so most events are missing. */
  partial = $state(false);

  readonly #inspector: Inspector;
  readonly #entries = new Map<number, Entry>();
  readonly #byAtom = new WeakMap<Atom.Atom<unknown>, Entry>();
  #nextId = 0;
  #log: TimelineEntry[] = [];
  #seq = 0;
  #builds = 0;
  #updates = 0;
  #interruptions = 0;
  #finalizers = 0;
  #frame: number | undefined;
  // Set once the model stops: a removal's timer may still fire, and must not schedule a frame.
  #stopped = false;
  #paused = false;

  constructor(inspector: Inspector) {
    this.#inspector = inspector;
  }

  get registry(): AtomRegistry.AtomRegistry {
    return this.#inspector.registry;
  }

  /** Starts following the registry; returns the function that stops. */
  start(): () => void {
    for (const node of this.registry.getNodes().values()) {
      const entry = this.#entry(node.atom);
      entry.node = node;
      // A valid node's value is read without computing anything.
      if (node.currentState() === "valid") {
        entry.value = node.value();
        entry.hasValue = true;
      }
    }
    const unsubscribe = this.#inspector.subscribe((event) =>
      this.#receive(event)
    );
    this.#schedule();
    return () => {
      unsubscribe();
      this.#stopped = true;
      if (this.#frame !== undefined) {
        cancelAnimationFrame(this.#frame);
        this.#frame = undefined;
      }
    };
  }

  /** Stops updating the timeline the views see, so it can be read; events are still recorded. */
  set paused(paused: boolean) {
    this.#paused = paused;
    this.#schedule();
  }

  get paused(): boolean {
    return this.#paused;
  }

  clearTimeline(): void {
    this.#log = [];
    this.#schedule();
  }

  #entry(atom: Atom.Atom<unknown>): Entry {
    let entry = this.#byAtom.get(atom);
    if (entry === undefined) {
      entry = {
        atom,
        builds: 0,
        hasValue: false,
        id: this.#nextId,
        identity: identify(atom),
        interruptedAt: undefined,
        interruptions: 0,
        node: undefined,
        removedAt: undefined,
        updates: 0,
        value: undefined,
      };
      this.#nextId += 1;
      this.#byAtom.set(atom, entry);
      this.#entries.set(entry.id, entry);
    }
    return entry;
  }

  #nameOf = (node: AtomRegistry.Node<unknown>): string =>
    this.#name(this.#entry(node.atom));

  // Once atoms have labels, one without is plumbing; without the plugin, none has.
  #labelled = false;

  #name(entry: Entry): string {
    return (
      entry.identity.name ??
      `${this.#labelled ? "plumbing" : "atom"} #${entry.id}`
    );
  }

  #receive(event: Event): void {
    const entry = this.#entry(event.node.atom);
    let detail = "";
    let related: readonly number[] = [];
    let source: UpdateSource | undefined;
    switch (event._tag) {
      case "NodeAdded": {
        entry.node = event.node;
        entry.removedAt = undefined;
        detail = "added";
        break;
      }
      case "Built": {
        entry.builds += 1;
        this.#builds += 1;
        detail = causeText(event.cause, this.#nameOf);
        if (event.cause._tag === "ParentChanged") {
          related = event.cause.parents.map(
            (parent) => this.#entry(parent.atom).id
          );
        }
        break;
      }
      case "Updated": {
        entry.value = event.value;
        entry.hasValue = true;
        entry.updates += 1;
        this.#updates += 1;
        ({ source } = event);
        detail = `→ ${preview(event.value, 60)}`;
        break;
      }
      case "ReadersChanged": {
        detail = `${event.readers} ${event.readers === 1 ? "reader" : "readers"}`;
        break;
      }
      case "Interrupted": {
        entry.interruptions += 1;
        entry.interruptedAt = event.time;
        this.#interruptions += 1;
        detail = "its effect was interrupted";
        break;
      }
      case "Finalized": {
        this.#finalizers += event.finalizers;
        detail = `${event.finalizers} ${event.finalizers === 1 ? "finalizer" : "finalizers"} ran`;
        break;
      }
      default: {
        entry.node = undefined;
        entry.removedAt = event.time;
        detail = "removed";
        // Again once it has lingered, to take it off the graph.
        setTimeout(() => this.#schedule(), lingerFor + 50);
        this.#prune();
      }
    }
    this.#seq += 1;
    this.#log.push({
      atom: entry.id,
      detail,
      related,
      seq: this.#seq,
      source,
      tag: event._tag,
      time: event.time,
    });
    if (this.#log.length > timelineLength) {
      this.#log.splice(0, this.#log.length - timelineLength);
    }
    this.#schedule();
  }

  /** Forgets the atoms removed longest ago, beyond the last few hundred. */
  #prune(): void {
    const removed = [...this.#entries.values()].filter(
      (entry) => entry.node === undefined
    );
    for (const entry of removed.slice(
      0,
      Math.max(0, removed.length - removedKept)
    )) {
      this.#entries.delete(entry.id);
      // An atom added again later starts a new entry, which the views see.
      this.#byAtom.delete(entry.atom);
    }
  }

  #schedule(): void {
    if (this.#stopped) {
      return;
    }
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = undefined;
      this.#publish();
    });
  }

  #publish(): void {
    const now = performance.now();
    const views: AtomView[] = [];
    const states: Record<string, number> = {};
    let readers = 0;
    let plumbing = 0;
    // An atom can get its label after the panel first sees it, as a cache's atom does when a
    // factory's call returns it later: read it again until it has one.
    for (const entry of this.#entries.values()) {
      if (entry.identity.name === undefined) {
        entry.identity = identify(entry.atom);
      }
    }
    const labelled = [...this.#entries.values()].some(
      (entry) => entry.identity.name !== undefined
    );
    this.#labelled = labelled;
    for (const entry of this.#entries.values()) {
      const { node } = entry;
      const lingering =
        entry.removedAt !== undefined && now - entry.removedAt < lingerFor;
      // Entries never in the registry since the panel started (a parent's id was taken) are skipped.
      if (node === undefined && !lingering && entry.removedAt === undefined) {
        continue;
      }
      const isPlumbing = labelled && entry.identity.name === undefined;
      const state = valueState(entry.value);
      if (node !== undefined) {
        readers += node.listeners.size;
        plumbing += isPlumbing ? 1 : 0;
        const stateKey = state._tag === "Value" ? "Value" : state._tag;
        states[stateKey] = (states[stateKey] ?? 0) + 1;
      }
      views.push({
        atom: entry.atom,
        builds: entry.builds,
        children:
          node === undefined
            ? []
            : [...node.children].map((child) => this.#entry(child.atom).id),
        hasValue: entry.hasValue,
        id: entry.id,
        identity: entry.identity,
        idleTTL: this.#inspector.idleTTL(entry.atom),
        interruptedAt: entry.interruptedAt,
        interruptions: entry.interruptions,
        keepAlive: entry.atom.keepAlive,
        live: node !== undefined,
        name: this.#name(entry),
        parents:
          node === undefined
            ? []
            : [...node.parents].map((parent) => this.#entry(parent.atom).id),
        plumbing: isPlumbing,
        readers: node?.listeners.size ?? 0,
        removedAt: entry.removedAt,
        state,
        updates: entry.updates,
        value: entry.value,
      });
    }
    this.atoms = views;
    this.totals = {
      atoms: views.filter((view) => view.live).length,
      builds: this.#builds,
      finalizers: this.#finalizers,
      interruptions: this.#interruptions,
      plumbing,
      readers,
      states,
      updates: this.#updates,
    };
    if (!this.#paused) {
      this.timeline = [...this.#log];
    }
    this.unlabelled = !labelled && views.length > 0;
    this.partial = !this.#inspector.complete;
  }
}
