// HTML input constraints read from a Schema's checks. Internal: not exported from the package.
import type { Schema } from "effect";
import { SchemaAST } from "effect";

import type { IndexPath } from "./paths.ts";

/** The attributes `field.constraints` can set. */
export interface Constraints {
  readonly required?: boolean | undefined;
  readonly minlength?: number | undefined;
  readonly maxlength?: number | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly pattern?: string | undefined;
}

type Check = NonNullable<SchemaAST.AST["checks"]>[number];

/** A check's `representation` payload, when it is an object. */
type Payload = Schema.JsonObject | undefined;

const isJsonArray = (json: Schema.Json): json is Schema.JsonArray =>
  Array.isArray(json);

const objectPayload = (payload: Schema.Json | undefined): Payload =>
  typeof payload === "object" && payload !== null && !isJsonArray(payload)
    ? payload
    : undefined;

const finite = (payload: Payload, key: string): number | undefined => {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

// An HTML pattern is compiled with the v flag and must match the whole value, while a Schema
// pattern matches anywhere in it: only one anchored at both ends, with no flags but u or v, means
// the same to both.
const sameAsHtmlPattern = (source: string, flags: Schema.Json | undefined) => {
  if (
    flags !== undefined &&
    !(typeof flags === "string" && ["", "u", "v"].includes(flags))
  ) {
    return false;
  }
  if (!(source.startsWith("^") && source.endsWith("$"))) {
    return false;
  }
  // `^a|b$` is anchored only at its ends: the browser wraps it as `^(?:^a|b$)$`.
  return !source.includes("|") && !source.endsWith("\\$");
};

// Effect's built-in checks say what they are in a `representation` annotation (`Schema.ts`, for
// example `isMinLength`). Only the ones that map exactly onto an HTML attribute are read; exclusive
// bounds and custom filters are left out.
const readers: Readonly<Record<string, (payload: Payload) => Constraints>> = {
  "effect/schema/isBetween": (payload) => ({
    max:
      payload?.exclusiveMaximum === true
        ? undefined
        : finite(payload, "maximum"),
    min:
      payload?.exclusiveMinimum === true
        ? undefined
        : finite(payload, "minimum"),
  }),
  "effect/schema/isBetweenLength": (payload) => ({
    maxlength: finite(payload, "maximum"),
    minlength: finite(payload, "minimum"),
  }),
  "effect/schema/isGreaterThanOrEqualTo": (payload) => ({
    min: finite(payload, "minimum"),
  }),
  "effect/schema/isLessThanOrEqualTo": (payload) => ({
    max: finite(payload, "maximum"),
  }),
  "effect/schema/isMaxLength": (payload) => ({
    maxlength: finite(payload, "maxLength"),
  }),
  "effect/schema/isMinLength": (payload) => ({
    minlength: finite(payload, "minLength"),
  }),
  "effect/schema/isPattern": (payload) => {
    const source = payload?.source;
    return typeof source === "string" &&
      sameAsHtmlPattern(source, payload?.flags)
      ? { pattern: source }
      : {};
  },
};

/** `Constraints`, to fill in. */
type Mutable = { -readonly [K in keyof Constraints]: Constraints[K] };

/** Copies `from`'s defined constraints into `into`, in `from`'s order. */
const merge = (into: Mutable, from: Constraints): void => {
  Object.assign(
    into,
    Object.fromEntries(
      Object.entries(from).filter(([, value]) => value !== undefined)
    )
  );
};

const readCheck = (check: Check, into: Mutable): void => {
  if (check._tag === "FilterGroup") {
    for (const inner of check.checks) {
      readCheck(inner, into);
    }
    return;
  }
  const representation = check.annotations?.representation;
  if (representation === undefined) {
    return;
  }
  const reader = readers[representation.id];
  if (reader !== undefined) {
    merge(into, reader(objectPayload(representation.payload)));
  }
};

// The node's checks, then the checks along its encoding chain (NumberFromString keeps a range check
// on the decoded Number and a NonEmpty check on the encoded String).
const readNode = (ast: SchemaAST.AST, into: Mutable): void => {
  for (const check of ast.checks ?? []) {
    readCheck(check, into);
  }
  for (const link of ast.encoding ?? []) {
    readNode(link.to, into);
  }
};

// Steps into declarations (a Schema.Class wraps its Struct) and suspensions, to a node with fields.
const unwrap = (ast: SchemaAST.AST): SchemaAST.AST => {
  if (SchemaAST.isSuspend(ast)) {
    return unwrap(ast.thunk());
  }
  if (SchemaAST.isDeclaration(ast)) {
    const [inner] = ast.typeParameters;
    if (inner !== undefined) {
      return unwrap(inner);
    }
    const last = ast.encoding?.at(-1)?.to;
    return last === undefined ? ast : unwrap(last);
  }
  return ast;
};

// The field at one step below `ast`, with whether its key is optional. In a union, the first member
// that has the step.
const step = (
  ast: SchemaAST.AST,
  segment: string | number
): { readonly ast: SchemaAST.AST; readonly optional: boolean } | undefined => {
  const node = unwrap(ast);
  if (SchemaAST.isUnion(node)) {
    for (const member of node.types) {
      const found = step(member, segment);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (SchemaAST.isObjects(node) && typeof segment === "string") {
    const property = node.propertySignatures.find(
      (candidate) => candidate.name === segment
    );
    return property === undefined
      ? undefined
      : { ast: property.type, optional: SchemaAST.isOptional(property.type) };
  }
  if (SchemaAST.isArrays(node) && typeof segment === "number") {
    const element = node.elements[segment] ?? node.rest[0];
    return element === undefined
      ? undefined
      : { ast: element, optional: SchemaAST.isOptional(element) };
  }
  return undefined;
};

// `optional(X)` is an optional key holding `X | undefined`; the constraints are X's.
const withoutUndefined = (ast: SchemaAST.AST): SchemaAST.AST => {
  if (!SchemaAST.isUnion(ast)) {
    return ast;
  }
  const types = ast.types.filter((member) => member._tag !== "Undefined");
  return types.length === 1 && types[0] !== undefined ? types[0] : ast;
};

/** The HTML constraints for the field at `path` in `schema`'s AST. */
export const constraintsAt = (
  root: SchemaAST.AST,
  path: IndexPath
): Constraints => {
  let found:
    | { readonly ast: SchemaAST.AST; readonly optional: boolean }
    | undefined = {
    ast: root,
    optional: false,
  };
  for (const segment of path) {
    found &&= step(found.ast, segment);
  }
  if (found === undefined) {
    return {};
  }
  const { ast, optional } = found;
  const into: Mutable = {};
  readNode(withoutUndefined(ast), into);
  // `required` means "not empty" to a browser, so it is set only where the Schema rejects an empty
  // string: a required key alone allows "", and a checkbox's boolean is always present.
  const { minlength } = into;
  const out: Mutable = {};
  if (!optional && typeof minlength === "number" && minlength >= 1) {
    out.required = true;
  }
  merge(out, into);
  return out;
};
