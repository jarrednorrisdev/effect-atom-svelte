// What the panel calls an atom, where it was declared, and whether it is the app's or plumbing.
import { Atom } from "effect/reactivity";

/** Where an atom was declared: a file as the dev server addresses it, and a line and column. */
export interface Place {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

/** What the panel knows of an atom from the atom itself. */
export interface Identity {
  /** Its label: the variable's name from the atomLabels plugin, or one the code gave it. */
  readonly name: string | undefined;
  /** Its key, if it is serializable, such as `AtomRpc:listTodos:home-todos`. */
  readonly key: string | undefined;
  readonly place: Place | undefined;
}

// The last `file:line:column` in a stack frame, with or without parentheses around it.
const framePattern = /(?<file>[^\s()]+):(?<line>\d+):(?<column>\d+)\)?\s*$/u;

/**
 * The place a stack frame points at. The plugin's frames hold the file as the dev server addresses
 * it; `Atom.withLabel`'s are the browser's, a URL with the dev server's origin and a query.
 */
export const parseFrame = (frame: string): Place | undefined => {
  const groups = framePattern.exec(frame)?.groups;
  if (groups?.file === undefined) {
    return undefined;
  }
  let { file } = groups;
  try {
    file = new URL(file).pathname;
  } catch {
    // Not a URL: already a path.
  }
  return { column: Number(groups.column), file, line: Number(groups.line) };
};

export const identify = (atom: Atom.Atom<unknown>): Identity => {
  const key = Atom.isSerializable(atom)
    ? atom[Atom.SerializableTypeId].key
    : undefined;
  const [name, frame] = atom.label ?? [];
  return {
    key,
    name,
    place: frame === undefined ? undefined : parseFrame(frame),
  };
};

/** The file's name without its folders, for a short reference: `todos.ts:12`. */
export const shortPlace = (place: Place): string =>
  `${place.file.split("/").at(-1) ?? place.file}:${place.line}`;

/**
 * Opens the place in the editor, through the dev server's `/__open-in-editor`, which takes a path
 * relative to the project's root or a full one: `/src/a.ts` becomes `src/a.ts`, and
 * `/@fs/home/me/a.ts` or `/@fs/C:/a.ts` the full path after `/@fs`.
 */
export const openInEditor = async (place: Place): Promise<void> => {
  const full = place.file.startsWith("/@fs/")
    ? place.file.slice("/@fs".length)
    : undefined;
  let file = place.file.replace(/^\//u, "");
  if (full !== undefined) {
    file = /^\/[a-z]:\//iu.test(full) ? full.slice(1) : full;
  }
  try {
    await fetch(
      `/__open-in-editor?file=${encodeURIComponent(`${file}:${place.line}:${place.column}`)}`
    );
  } catch {
    // Not a Vite dev server, or it isn't running: there is no editor to open.
  }
};
