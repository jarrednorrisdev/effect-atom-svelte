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
 * Names an atom in place, keeping its identity: `Atom.withLabel` returns a copy, which would leave
 * any atom that captured the original pointing at an unlabelled one.
 *
 * A label the code gave itself wins. The one `Atom.serializable` falls back to, its key (such as
 * `AtomRpc:listTodos:home-todos` for an RPC query), gives way to the variable's name.
 */
const setLabel = (atom: Atom.Atom<unknown>, text: string, at: string): void => {
  const current = atom.label;
  const key = Atom.isSerializable(atom)
    ? atom[Atom.SerializableTypeId].key
    : undefined;
  if (current !== undefined && current[0] !== key) {
    return;
  }
  try {
    // The second element is a stack frame, as Effect's own labels hold.
    (atom as Labelled).label = [text, `at ${text} (${at})`];
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
    setLabel(value, text, at);
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
        setLabel(member, `${text}(${formatArg(arg)})`, at);
      }
      return member;
    }) as T;
  }
  return value;
};
