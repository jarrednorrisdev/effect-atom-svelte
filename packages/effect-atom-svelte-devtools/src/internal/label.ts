// What code transformed by the atomLabels Vite plugin calls: the plugin wraps the value of each
// top-level declaration made by a call in `label(value, name, at)`. The plugin serves this module
// to the app as is, so it imports nothing.
//
// Only atoms are labelled; anything else passes through untouched, which is what lets the plugin
// wrap calls without knowing what they return.

// Effect Atom's type ids (effect/reactivity, Atom.TypeId and Atom.SerializableTypeId).
const AtomTypeId = "~effect/reactivity/Atom";
const SerializableTypeId = "~effect-atom/atom/Atom/Serializable";

interface Labelled {
  label?: readonly [name: string, stack: string];
  readonly [SerializableTypeId]?: { readonly key: string };
}

const isAtom = (value: unknown): value is Labelled =>
  typeof value === "object" && value !== null && AtomTypeId in value;

/**
 * Names an atom in place, keeping its identity: `Atom.withLabel` returns a copy, which would leave
 * any atom that captured the original pointing at an unlabelled one.
 *
 * A label the code gave itself wins. The one `Atom.serializable` falls back to, its key (such as
 * `AtomRpc:listTodos:home-todos` for an RPC query), gives way to the variable's name.
 */
const setLabel = (atom: Labelled, text: string, at: string): void => {
  const current = atom.label;
  if (current !== undefined && current[0] !== atom[SerializableTypeId]?.key) {
    return;
  }
  try {
    // The second element is a stack frame, as Effect's own labels hold.
    atom.label = [text, `at ${text} (${at})`];
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

/**
 * Labels `value` with `text` and the place it was declared, `at` (`/src/lib/todos.ts:12:14`), if
 * it is an atom, and returns it. For an `Atom.family`, returns a family that labels each member
 * with its argument, as `todoAtom(3)`.
 */
export const label = <T>(
  value: T,
  text: string,
  at: string,
  family?: boolean
): T => {
  if (isAtom(value)) {
    setLabel(value, text, at);
  } else if (family && typeof value === "function") {
    const members = value as (arg: unknown) => unknown;
    return ((arg: unknown) => {
      const member = members(arg);
      if (isAtom(member)) {
        setLabel(member, `${text}(${formatArg(arg)})`, at);
      }
      return member;
    }) as T;
  }
  return value;
};
