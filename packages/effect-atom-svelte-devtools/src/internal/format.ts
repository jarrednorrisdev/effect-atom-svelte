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
      return {
        _tag: "Failure",
        cause: Cause.pretty(result.cause),
        waiting: result.waiting,
      };
    }
  }
};

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
    return `${value.name}: ${value.message}`;
  }
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value]
        .slice(0, maxItems)
        .map(([key, entry]) => [String(key), inner(entry)])
    );
  }
  if (value instanceof Set) {
    return [...value].slice(0, maxItems).map(inner);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, maxItems).map(inner);
    return value.length > maxItems
      ? [...items, `… ${value.length - maxItems} more`]
      : items;
  }
  if (hasToJSON(value)) {
    const json = value.toJSON();
    if (json !== value) {
      return inner(json);
    }
  }
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, maxItems)
      .map(([key, entry]) => [key, inner(entry)])
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

const json = (data: unknown, indent?: number): string =>
  typeof data === "string"
    ? JSON.stringify(data)
    : (JSON.stringify(data, undefined, indent) ?? String(data));

/** The value written out in full, for its sheet. */
export const detail = (value: unknown): string => json(plain(value), 2);

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

/** An error with its fields, as `CityNotFound { city: "Atlantis" }`, or its message if it has one. */
const errorText = (error: unknown): string => {
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
  const body = fields.map(([key, field]) => `${key}: ${json(plain(field))}`);
  return body.length > 0 ? `${name} { ${body.join(", ")} }` : name;
};

/**
 * What a failure failed with, from its first reason: a typed error by its name (`CityNotFound`),
 * or with its fields when `full`; a defect as `defect: TypeError`; an interruption as
 * `interrupted`.
 */
export const failureText = (
  cause: Cause.Cause<unknown>,
  full = false
): string => {
  const [reason] = cause.reasons;
  if (reason === undefined) {
    return "empty cause";
  }
  if (Cause.isFailReason(reason)) {
    return full ? errorText(reason.error) : errorName(reason.error);
  }
  if (Cause.isDieReason(reason)) {
    return `defect: ${full ? errorText(reason.defect) : errorName(reason.defect)}`;
  }
  return "interrupted";
};

/** An `AsyncResult` on one line: its value, through `inner`, or what it failed with. */
const resultText = (
  result: AsyncResult.AsyncResult<unknown, unknown>,
  inner: (value: unknown) => string
): string => {
  let text = "Initial";
  if (result._tag === "Success") {
    text = inner(result.value);
  } else if (result._tag === "Failure") {
    text = failureText(result.cause, true);
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
