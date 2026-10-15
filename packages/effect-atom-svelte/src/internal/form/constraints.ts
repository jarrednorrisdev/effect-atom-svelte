// HTML input constraints read from a Schema's checks. Internal: not exported from the package.
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

interface Representation {
  readonly id?: unknown;
  readonly payload?: Readonly<Record<string, unknown>> | null;
}

type Check = NonNullable<SchemaAST.AST["checks"]>[number];

type Payload = Readonly<Record<string, unknown>> | undefined;

const finite = (payload: Payload, key: string): number | undefined => {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

// Effect's built-in checks say what they are in a `representation` annotation (`Schema.ts`, for
// example `isMinLength`). Only the ones that map exactly onto an HTML attribute are read; exclusive
// bounds and custom filters are left out.
const readers: Readonly<Record<string, (payload: Payload) => Constraints>> = {
  "effect/schema/isBetween": (payload) => ({
    max:
      payload?.["exclusiveMaximum"] === true
        ? undefined
        : finite(payload, "maximum"),
    min:
      payload?.["exclusiveMinimum"] === true
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
  // An HTML pattern is compiled with the v flag and must match the whole value, while a Schema
  // pattern matches anywhere in it: only one anchored at both ends, with no flags but u or v, means
  // the same to both.
  "effect/schema/isPattern": (payload) => {
    const source = payload?.["source"];
    const flags = payload?.["flags"];
    return typeof source === "string" &&
      (flags === undefined || ["", "u", "v"].includes(String(flags))) &&
      source.startsWith("^") &&
      source.endsWith("$") &&
      !source.endsWith("\\$")
      ? { pattern: source }
      : {};
  },
};

const readCheck = (check: Check, into: Record<string, unknown>): void => {
  if (check._tag === "FilterGroup") {
    for (const inner of check.checks) {
      readCheck(inner, into);
    }
    return;
  }
  const representation = check.annotations?.["representation"] as
    | Representation
    | undefined;
  const id = representation?.id;
  const reader = typeof id === "string" ? readers[id] : undefined;
  if (reader === undefined) {
    return;
  }
  for (const [key, value] of Object.entries(
    reader(representation?.payload ?? undefined)
  )) {
    if (value !== undefined) {
      into[key] = value;
    }
  }
};

// The node's checks, then the checks along its encoding chain (NumberFromString keeps a range check
// on the decoded Number and a NonEmpty check on the encoded String).
const readNode = (ast: SchemaAST.AST, into: Record<string, unknown>): void => {
  for (const check of ast.checks ?? []) {
    readCheck(check, into);
  }
  for (const link of ast.encoding ?? []) {
    readNode(link.to, into);
  }
};

interface PropertyLike {
  readonly name: PropertyKey;
  readonly type: SchemaAST.AST;
}

// Steps into declarations (a Schema.Class wraps its Struct) and suspensions, to a node with fields.
const unwrap = (ast: SchemaAST.AST): SchemaAST.AST => {
  if (SchemaAST.isSuspend(ast)) {
    return unwrap((ast as unknown as { thunk: () => SchemaAST.AST }).thunk());
  }
  if (SchemaAST.isDeclaration(ast)) {
    const [inner] = (
      ast as unknown as { typeParameters: readonly SchemaAST.AST[] }
    ).typeParameters;
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
    for (const member of (
      node as unknown as { types: readonly SchemaAST.AST[] }
    ).types) {
      const found = step(member, segment);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (SchemaAST.isObjects(node) && typeof segment === "string") {
    const property = (
      node as unknown as { propertySignatures: readonly PropertyLike[] }
    ).propertySignatures.find((candidate) => candidate.name === segment);
    return property === undefined
      ? undefined
      : { ast: property.type, optional: SchemaAST.isOptional(property.type) };
  }
  if (SchemaAST.isArrays(node) && typeof segment === "number") {
    const arrays = node as unknown as {
      elements: readonly SchemaAST.AST[];
      rest: readonly SchemaAST.AST[];
    };
    const element = arrays.elements[segment] ?? arrays.rest[0];
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
  const types = (
    ast as unknown as { types: readonly SchemaAST.AST[] }
  ).types.filter((member) => member._tag !== "Undefined");
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
  const into: Record<string, unknown> = {};
  readNode(withoutUndefined(ast), into);
  // `required` means "not empty" to a browser, so it is set only where the Schema rejects an empty
  // string: a required key alone allows "", and a checkbox's boolean is always present.
  const { minlength } = into;
  const out: Record<string, unknown> = {};
  if (!optional && typeof minlength === "number" && minlength >= 1) {
    out["required"] = true;
  }
  for (const [key, value] of Object.entries(into)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as Constraints;
};
