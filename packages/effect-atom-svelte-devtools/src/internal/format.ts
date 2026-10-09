// How the panel shows an atom's value: a one-line preview, and the whole of it on its sheet.
import { Cause } from "effect";
import { AsyncResult } from "effect/reactivity";

/** The state of an atom's value, for its marks and its sheet. */
export type ValueState =
  | { readonly _tag: "Value" }
  | {
      readonly _tag: "Initial" | "Success" | "Failure";
      readonly waiting: boolean;
    };

export const valueState = (value: unknown): ValueState =>
  AsyncResult.isAsyncResult(value)
    ? { _tag: value._tag, waiting: value.waiting }
    : { _tag: "Value" };

/** A short description of the state: `Success, waiting`. */
export const stateText = (state: ValueState): string => {
  if (state._tag === "Value") {
    return "";
  }
  return state.waiting ? `${state._tag}, waiting` : state._tag;
};

const hasToJSON = (value: object): value is { toJSON: () => unknown } =>
  typeof (value as { toJSON?: unknown }).toJSON === "function";

// How much of a value is written out: deeper or longer parts are cut short.
const maxDepth = 5;
const maxItems = 50;

// Values JSON has no words for, written out bare: `NaN`, `Infinity`, `undefined`.
const bare = (text: string) => `\u0000${text}\u0000`;

const json = (data: unknown, indent?: number): string =>
  (typeof data === "string"
    ? JSON.stringify(data)
    : (JSON.stringify(data, undefined, indent) ?? String(data))
  ).replaceAll(/"\\u0000(?<text>.*?)\\u0000"/gu, "$<text>");

/** An error's name: a tagged error's `_tag`, an `Error`'s `name`, or the value as a string. */
const errorName = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    if ("_tag" in error && typeof error._tag === "string") {
      return error._tag;
    }
    if (error instanceof Error) {
      return error.name;
    }
  }
  return String(error);
};

/**
 * An error with its fields, each written by `write`, as `CityNotFound { city: "Atlantis" }`, or
 * its message if it has one.
 */
const errorText = (
  error: unknown,
  write: (field: unknown) => string
): string => {
  const name = errorName(error);
  if (typeof error !== "object" || error === null) {
    return name;
  }
  if (
    "message" in error &&
    typeof error.message === "string" &&
    error.message !== ""
  ) {
    return `${name}: ${error.message}`;
  }
  const fields = Object.entries(error).filter(([key]) => key !== "_tag");
  const body = fields.map(([key, field]) => `${key}: ${write(field)}`);
  return body.length > 0 ? `${name} { ${body.join(", ")} }` : name;
};

/**
 * What a failure failed with, from its first reason: a typed error by its name (`CityNotFound`),
 * or with its fields, each written by `write`, when given; a defect as `defect: TypeError`; an
 * interruption as `interrupted`.
 */
export const failureText = (
  cause: Cause.Cause<unknown>,
  write?: (field: unknown) => string
): string => {
  const [reason] = cause.reasons;
  if (reason === undefined) {
    return "empty cause";
  }
  if (Cause.isFailReason(reason)) {
    return write ? errorText(reason.error, write) : errorName(reason.error);
  }
  if (Cause.isDieReason(reason)) {
    return `defect: ${write ? errorText(reason.defect, write) : errorName(reason.defect)}`;
  }
  return "interrupted";
};

const plainResult = (
  result: AsyncResult.AsyncResult<unknown, unknown>,
  inner: (value: unknown) => unknown
): unknown => {
  switch (result._tag) {
    case "Initial": {
      return { _tag: "Initial", waiting: result.waiting };
    }
    case "Success": {
      return {
        _tag: "Success",
        value: inner(result.value),
        waiting: result.waiting,
      };
    }
    default: {
      // What it failed with, fields and all, as the graph's note promises; then the whole cause.
      // oxlint-disable-next-line eslint/sort-keys -- what it failed with reads before the whole cause
      return {
        _tag: "Failure",
        error: failureText(result.cause, (field) => json(inner(field))),
        cause: Cause.pretty(result.cause),
        waiting: result.waiting,
      };
    }
  }
};

/** The first `maxItems` items, and how many more there are. */
const listed = <A>(items: readonly A[], inner: (item: A) => unknown) => {
  const shown = items.slice(0, maxItems).map(inner);
  return items.length > maxItems
    ? [...shown, `… ${items.length - maxItems} more`]
    : shown;
};

/** An object cut to `maxItems` entries, saying how many more there are. */
const withMore = (object: Record<string, unknown>, count: number) =>
  count > maxItems ? { ...object, "…": `${count - maxItems} more` } : object;

const isPrimitive = (value: unknown) =>
  value === null || (typeof value !== "object" && typeof value !== "function");

const plainObject = (
  value: object,
  inner: (value: unknown) => unknown
): unknown => {
  if (AsyncResult.isAsyncResult(value)) {
    return plainResult(value, inner);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    // A tagged error's fields, as `CityNotFound { city: "Atlantis" }`.
    return errorText(value, (field) => json(inner(field)));
  }
  if (value instanceof Map) {
    const entries = [...value];
    // Primitive keys that stay distinct as strings make an object; any other keys would collide
    // or lose themselves as strings, so those maps are written as `[key, value]` pairs.
    const keys = entries.map(([key]) => key);
    if (
      keys.every((key) => isPrimitive(key)) &&
      new Set(keys.map(String)).size === keys.length
    ) {
      return withMore(
        Object.fromEntries(
          entries
            .slice(0, maxItems)
            .map(([key, entry]) => [String(key), inner(entry)])
        ),
        entries.length
      );
    }
    return listed(entries, ([key, entry]) => [inner(key), inner(entry)]);
  }
  if (value instanceof Set) {
    return listed([...value], inner);
  }
  if (Array.isArray(value)) {
    return listed(value, inner);
  }
  if (hasToJSON(value)) {
    const data = value.toJSON();
    if (data !== value) {
      return inner(data);
    }
  }
  const entries = Object.entries(value);
  return withMore(
    Object.fromEntries(
      entries.slice(0, maxItems).map(([key, entry]) => [key, inner(entry)])
    ),
    entries.length
  );
};

/**
 * Turns a value into plain data to print: an `AsyncResult` as its tag and contents, a failure's
 * cause pretty-printed, Effect's data types through their own `toJSON`, maps and sets as entries,
 * and anything too deep, too long or circular cut short.
 */
export const plain = (
  value: unknown,
  depth = 0,
  seen = new Set<object>()
): unknown => {
  switch (typeof value) {
    case "function": {
      return `ƒ ${value.name || "anonymous"}`;
    }
    case "bigint": {
      return `${value}n`;
    }
    case "symbol": {
      return value.toString();
    }
    case "number": {
      return Number.isFinite(value) ? value : bare(String(value));
    }
    case "undefined": {
      return depth === 0 ? value : bare("undefined");
    }
    case "object": {
      break;
    }
    default: {
      return value;
    }
  }
  if (value === null) {
    return value;
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  if (depth > maxDepth) {
    return "…";
  }
  seen.add(value);
  try {
    return plainObject(value, (inner) => plain(inner, depth + 1, seen));
  } catch {
    return "[unreadable]";
  } finally {
    seen.delete(value);
  }
};

/** The value written out in full, for its sheet. */
export const detail = (value: unknown): string => json(plain(value), 2);

/** An `AsyncResult` on one line: its value, through `inner`, or what it failed with. */
const resultText = (
  result: AsyncResult.AsyncResult<unknown, unknown>,
  inner: (value: unknown) => string
): string => {
  let text = "Initial";
  if (result._tag === "Success") {
    text = inner(result.value);
  } else if (result._tag === "Failure") {
    text = failureText(result.cause, (field) => json(plain(field)));
  }
  return result.waiting ? `${text}, waiting` : text;
};

/** The value on one line, cut to `length` characters. */
export const preview = (value: unknown, length = 48): string => {
  const text = AsyncResult.isAsyncResult(value)
    ? resultText(value, (inner) => preview(inner, length))
    : json(plain(value));
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};
