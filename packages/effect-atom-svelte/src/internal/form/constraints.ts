// HTML input constraints read from a Schema's checks. Internal: not exported from the package.
import { SchemaAST } from "effect";

import type { IndexPath } from "./paths.ts";

/** The attributes `field.constraints` can set. */
export interface Constraints {
  readonly required?: boolean;
  readonly minlength?: number;
  readonly maxlength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
}

interface Representation {
  readonly id?: unknown;
  readonly payload?: Readonly<Record<string, unknown>> | null;
}

type Check = NonNullable<SchemaAST.AST["checks"]>[number];

// Effect's built-in checks say what they are in a `representation` annotation (`Schema.ts`, for
// example `isMinLength`). Only the ones that map exactly onto an HTML attribute are read; exclusive
// bounds and custom filters are left out.
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
  const payload = representation?.payload ?? undefined;
  const number = (key: string) => {
    const value = payload?.[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };
  switch (representation?.id) {
    case "effect/schema/isMinLength": {
      into["minlength"] = number("minLength");
      break;
    }
    case "effect/schema/isMaxLength": {
      into["maxlength"] = number("maxLength");
      break;
    }
    case "effect/schema/isGreaterThanOrEqualTo": {
      into["min"] = number("minimum");
      break;
    }
    case "effect/schema/isLessThanOrEqualTo": {
      into["max"] = number("maximum");
      break;
    }
    case "effect/schema/isBetween": {
      if (payload?.["exclusiveMinimum"] !== true) {
        into["min"] = number("minimum");
      }
      if (payload?.["exclusiveMaximum"] !== true) {
        into["max"] = number("maximum");
      }
      break;
    }
    case "effect/schema/isPattern": {
      // HTML patterns match the whole value and take no flags.
      const source = payload?.["source"];
      const flags = payload?.["flags"];
      if (typeof source === "string" && (flags === "" || flags === undefined)) {
        into["pattern"] = source;
      }
      break;
    }
    default:
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
      ast as unknown as { typeParameters: ReadonlyArray<SchemaAST.AST> }
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
      node as unknown as { types: ReadonlyArray<SchemaAST.AST> }
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
      node as unknown as { propertySignatures: ReadonlyArray<PropertyLike> }
    ).propertySignatures.find((candidate) => candidate.name === segment);
    return property === undefined
      ? undefined
      : { ast: property.type, optional: SchemaAST.isOptional(property.type) };
  }
  if (SchemaAST.isArrays(node) && typeof segment === "number") {
    const arrays = node as unknown as {
      elements: ReadonlyArray<SchemaAST.AST>;
      rest: ReadonlyArray<SchemaAST.AST>;
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
    ast as unknown as { types: ReadonlyArray<SchemaAST.AST> }
  ).types.filter((member) => member._tag !== "Undefined");
  return types.length === 1 && types[0] !== undefined ? types[0] : ast;
};

/** The HTML constraints for the field at `path` in `schema`'s AST. */
export const constraintsAt = (
  root: SchemaAST.AST,
  path: IndexPath
): Constraints => {
  let ast = root;
  let optional = false;
  for (const segment of path) {
    const next = step(ast, segment);
    if (next === undefined) {
      return {};
    }
    ast = next.ast;
    optional = next.optional;
  }
  const into: Record<string, unknown> = {};
  readNode(withoutUndefined(ast), into);
  // `required` means "not empty" to a browser, so it is set only where the Schema rejects an empty
  // string: a required key alone allows "", and a checkbox's boolean is always present.
  const minlength = into["minlength"];
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
