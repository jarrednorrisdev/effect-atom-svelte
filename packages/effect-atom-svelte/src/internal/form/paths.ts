// Paths into a form's values, and the item keys that let state follow an array item when it moves.
// Internal: not exported from the package.
//
// Two kinds of path: an index path (["items", 0, "qty"]) addresses the values as they are now, and
// a key path (["items", 7, "qty"]) names array items by their key instead of their index. Touched
// state and errors are stored by key path, so they move with their item. Both are arrays of
// strings (object keys) and numbers (an index, or an item key).

/** A path into a form's values: object keys, and numbers for array indexes. */
export type IndexPath = readonly (string | number)[];

/** A path with each array index replaced by that item's key. */
export type KeyPath = readonly (string | number)[];

/** Item keys per array, by the array's key path (as `pathId`). */
export type Keys = ReadonlyMap<string, readonly number[]>;

/** A string for a key path, to use as a map key. */
export const pathId = (path: KeyPath): string => JSON.stringify(path);

/** Parses a `pathId` back into its path. */
export const fromPathId = (id: string): KeyPath => JSON.parse(id) as KeyPath;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value at `path`, or `undefined` when a step is missing. */
export const getIn = (root: unknown, path: IndexPath): unknown => {
  let current = root;
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === "number") {
      current = current[segment];
    } else if (isRecord(current) && typeof segment === "string") {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
};

/** A copy of `root` with `value` at `path`, sharing everything off the path. */
export const setIn = (
  root: unknown,
  path: IndexPath,
  value: unknown
): unknown => {
  if (path.length === 0) {
    return value;
  }
  const [head, ...rest] = path;
  if (typeof head === "number") {
    const array = Array.isArray(root) ? [...root] : [];
    array[head] = setIn(array[head], rest, value);
    return array;
  }
  const record = isRecord(root) ? root : {};
  return {
    ...record,
    [head as string]: setIn(record[head as string], rest, value),
  };
};

/** Whether `path` starts with `prefix`. */
export const startsWith = (path: KeyPath, prefix: KeyPath): boolean =>
  prefix.length <= path.length &&
  prefix.every((segment, index) => path[index] === segment);

/**
 * The key path for an index path, or `undefined` when an index has no item. A number segment is an
 * index only where the value so far is an array; a record's numeric-looking keys are strings.
 */
export const toKeyPath = (keys: Keys, path: IndexPath): KeyPath | undefined => {
  const out: (string | number)[] = [];
  for (const segment of path) {
    if (typeof segment === "number") {
      const key = keys.get(pathId(out))?.[segment];
      if (key === undefined) {
        return undefined;
      }
      out.push(key);
    } else {
      out.push(segment);
    }
  }
  return out;
};

/** The index path for a key path, or `undefined` when one of its items is gone. */
export const toIndexPath = (
  keys: Keys,
  path: KeyPath
): IndexPath | undefined => {
  const out: (string | number)[] = [];
  for (const [position, segment] of path.entries()) {
    if (typeof segment === "number") {
      const arrayKeys = keys.get(pathId(path.slice(0, position)));
      const index = arrayKeys?.indexOf(segment) ?? -1;
      if (index < 0) {
        return undefined;
      }
      out.push(index);
    } else {
      out.push(segment);
    }
  }
  return out;
};

/**
 * Item keys for every array in `values`. Arrays that already have keys keep them, by position, and
 * new positions take fresh keys from `next`; keys for arrays that are gone are dropped.
 */
export const reconcileKeys = (
  values: unknown,
  previous: Keys,
  next: () => number
): Map<string, readonly number[]> => {
  const out = new Map<string, readonly number[]>();
  const walk = (value: unknown, path: KeyPath) => {
    if (Array.isArray(value)) {
      const id = pathId(path);
      const old = previous.get(id) ?? [];
      const keys =
        old.length === value.length
          ? old
          : Array.from(
              { length: value.length },
              (_, index) => old[index] ?? next()
            );
      out.set(id, keys);
      for (const [index, item] of value.entries()) {
        walk(item, [...path, keys[index] as number]);
      }
    } else if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        walk(item, [...path, key]);
      }
    }
  };
  walk(values, []);
  return out;
};

/** Whether every item key in `path` still belongs to its array. */
export const isLive = (keys: Keys, path: KeyPath): boolean =>
  toIndexPath(keys, path) !== undefined;

/** Plain-data equality for form values: arrays, records, dates, and `Object.is` for the rest. */
export const equals = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((item, index) => equals(item, b[index]))
    );
  }
  if (isRecord(a) && isRecord(b)) {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
      return false;
    }
    const keysA = Object.keys(a).filter((key) => a[key] !== undefined);
    const keysB = Object.keys(b).filter((key) => b[key] !== undefined);
    return (
      keysA.length === keysB.length &&
      keysA.every((key) => equals(a[key], b[key]))
    );
  }
  return false;
};

/** A string safe in an element id for a key path: `items-i7-qty`, item keys marked with `i`. */
export const idSuffix = (path: KeyPath): string =>
  path
    .map((segment) =>
      typeof segment === "number"
        ? `i${segment}`
        : segment.replaceAll(/[^\w-]/gu, "_")
    )
    .join("-");

/** The `name` attribute for an index path: `items.0.qty`. */
export const nameOf = (path: IndexPath): string => path.join(".");
