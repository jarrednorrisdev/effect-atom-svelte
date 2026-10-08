// What code transformed by the atomLabels Vite plugin calls: the plugin wraps the value of each
// declaration it labels in `label(value, name, at, options)`, and names each component with
// `component(name, file)`. The plugin serves this module to the app as is.
//
// Only atoms are labelled; anything else passes through untouched, which is what lets the plugin
// wrap calls without knowing what they return.

import { nameComponent, registries } from "effect-atom-svelte/inspector";
import { Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";

/**
 * Names the component being set up, for the inspector scopes its hooks report to: the plugin calls
 * it at the top of each component's instance script.
 */
export const component = (name: string, file: string): void => {
  nameComponent(name, file);
};

interface Labelled {
  label?: readonly [name: string, stack: string];
}

/**
 * Where a label of the plugin's came from: a top-level `declaration`, a `local` one inside a
 * function, a `family`'s member, or a `call` to an atom factory.
 */
type Kind = "declaration" | "local" | "family" | "call";

// The kind of each label this module set, to tell which a later one may replace.
const kinds = new WeakMap<object, Kind>();

// The labels of its own each kind may replace: the more specific name wins. A factory's call,
// which carries the key, wins over a name made inside the factory; a family's member over both.
const replaces: Readonly<Record<Kind, readonly Kind[]>> = {
  call: ["local"],
  declaration: ["local"],
  family: ["local", "call"],
  local: [],
};

/**
 * Names an atom in place, keeping its identity: `Atom.withLabel` returns a copy, which would leave
 * any atom that captured the original pointing at an unlabelled one.
 *
 * A label the code gave itself wins. The one `Atom.serializable` falls back to, its key (such as
 * `AtomRpc:listTodos:home-todos` for an RPC query), gives way to the variable's name. Of this
 * module's own labels, a more specific kind replaces a less specific one (`replaces`).
 */
const setLabel = (
  atom: Atom.Atom<unknown>,
  text: string,
  at: string,
  kind: Kind
): void => {
  const current = atom.label;
  const key = Atom.isSerializable(atom)
    ? atom[Atom.SerializableTypeId].key
    : undefined;
  const previous = kinds.get(atom);
  const free = current === undefined || current[0] === key;
  if (!free && !(previous !== undefined && replaces[kind].includes(previous))) {
    return;
  }
  try {
    // The second element is a stack frame, as Effect's own labels hold.
    (atom as Labelled).label = [text, `at ${text} (${at})`];
    kinds.set(atom, kind);
  } catch {
    // A frozen atom keeps the label it has.
  }
};

/** A family member's argument, short enough for a label. */
const formatArg = (arg: unknown): string => {
  let text: string;
  try {
    text =
      typeof arg === "string"
        ? JSON.stringify(arg)
        : (JSON.stringify(arg) ?? String(arg));
  } catch {
    text = String(arg);
  }
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
};

interface Kept {
  readonly atom: WeakRef<Atom.Atom<unknown>>;
  readonly source: string;
}

// The last atom declared under each name in each file, with a hash of its declaration.
const kept = new Map<string, Kept>();

// How long the carried-over value is held for the reloaded components to read it: the registry
// removes an atom nobody reads on its next tick.
const holdFor = 1000;

/**
 * After a hot reload re-runs a module, gives the state atom it declared, in each registry, the
 * value the atom it replaces holds: the one declared before under the same `key` (file and name),
 * if its declaration's `source` is the same. An edited declaration starts from its new value.
 */
export const keepAcrossReloads = (
  atom: Atom.Atom<unknown>,
  key: string,
  source: string,
  inRegistries: () => readonly AtomRegistry.AtomRegistry[] = registries
): void => {
  const previous = kept.get(key);
  kept.set(key, { atom: new WeakRef(atom), source });
  const replaced = previous?.atom.deref();
  if (
    replaced === undefined ||
    replaced === atom ||
    previous?.source !== source ||
    !Atom.isWritable(atom)
  ) {
    return;
  }
  for (const registry of inRegistries()) {
    const node = registry.getNodes().get(replaced);
    if (node?.currentState() !== "valid") {
      continue;
    }
    const release = registry.mount(atom);
    registry.set(atom, node.value());
    setTimeout(release, holdFor);
  }
};

/** What the plugin knows about a declaration besides its name and place. */
interface LabelOptions {
  /** The value is an `Atom.family`: label its members. */
  readonly family?: boolean;
  /** A state atom a module declares, and a hash of its declaration: keep its value across reloads. */
  readonly keep?: string;
  /** Declared inside a function, so a factory's call names it better. */
  readonly local?: boolean;
}

/**
 * Labels `value` with `text` and the place it was declared, `at` (`/src/lib/todos.ts:12:14`), if
 * it is an atom, and returns it. For an `Atom.family`, returns a family that labels each member
 * with its argument, as `todoAtom(3)`.
 */
export const label = <T>(
  value: T,
  text: string,
  at: string,
  options: LabelOptions = {}
): T => {
  if (Atom.isAtom(value)) {
    setLabel(value, text, at, options.local ? "local" : "declaration");
    if (options.keep !== undefined) {
      keepAcrossReloads(
        value,
        `${at.replace(/:\d+:\d+$/u, "")}#${text}`,
        options.keep
      );
    }
  } else if (options.family && typeof value === "function") {
    const members = value as (arg: unknown) => unknown;
    return ((arg: unknown) => {
      const member = members(arg);
      if (Atom.isAtom(member)) {
        setLabel(member, `${text}(${formatArg(arg)})`, at, "family");
      }
      return member;
    }) as T;
  }
  return value;
};

/**
 * Wraps a call to an atom factory, `f` (`mapDraftAtom`), so its result, if it is an atom, is named
 * after the call and its arguments: `mapDraftAtom({"doc":1})`. Every call's result is named, so
 * two atoms made for equal keys get the same name; an atom returned again keeps the name it has.
 */
export const call = <F>(f: F, name: string, at: string): F => {
  if (typeof f !== "function") {
    // Calling it fails as the code would have without the plugin.
    return f;
  }
  const factory = f as (...args: unknown[]) => unknown;
  return ((...args: unknown[]) => {
    const result = factory(...args);
    if (Atom.isAtom(result)) {
      setLabel(
        result,
        `${name}(${args.map(formatArg).join(", ")})`,
        at,
        "call"
      );
    }
    return result;
  }) as F;
};
