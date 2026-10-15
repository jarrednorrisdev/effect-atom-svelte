// Turns a Schema decode failure into one message per path. Internal: not exported from the package.
import type { Schema } from "effect";
import { SchemaIssue } from "effect";

import type { IndexPath } from "./paths.ts";

/** A message for a leaf issue, or `undefined` to fall back on Effect's. */
export type LeafHook = (issue: SchemaIssue.Leaf) => string | undefined;

/** A message for a failed check, or `undefined` to fall back on Effect's. */
export type CheckHook = (issue: SchemaIssue.Filter) => string | undefined;

/** One error from a decode: where it is, and what to show. */
export interface PathIssue {
  readonly path: IndexPath;
  readonly message: string;
}

// The lookup Effect's default hooks do (`findMessage` in SchemaIssue.ts, which is private): a
// `message` annotation, or `messageMissingKey`/`messageUnexpectedKey` for those issues. Done here
// so an annotated message wins over the caller's hooks, which would otherwise replace Effect's
// default hooks and with them the annotation lookup.
const messageKeys: Readonly<Record<string, string>> = {
  MissingKey: "messageMissingKey",
  UnexpectedKey: "messageUnexpectedKey",
};

const findMessage = (issue: SchemaIssue.Issue): string | undefined => {
  if (issue._tag === "Pointer") {
    return undefined;
  }
  if (issue._tag === "Encoding") {
    return findMessage(issue.issue);
  }
  let source: {
    readonly annotations?: Schema.Annotations.Annotations | undefined;
  };
  if (issue._tag === "Filter") {
    source = issue.filter;
  } else if ("annotations" in issue) {
    source = issue;
  } else {
    source = issue.ast;
  }
  const { annotations } = source;
  const message = annotations?.[messageKeys[issue._tag] ?? "message"];
  return typeof message === "string" ? message : undefined;
};

const effectFormatter = SchemaIssue.makeFormatterStandardSchemaV1();

type Segment = PropertyKey | { readonly key: PropertyKey };

// Paths from Effect are PropertyKeys, or `{ key }` in Standard Schema's type; a form's paths are
// object keys and array indexes.
const normalize = (path: readonly Segment[]): IndexPath =>
  path.map((segment) => {
    const key = typeof segment === "object" ? segment.key : segment;
    return typeof key === "number" ? key : String(key);
  });

// The paths a check's issue points at, below `path`: a check on a Struct that returns
// `{ path, issue }` wraps its issue in a Pointer.
const pointedPaths = (
  issue: SchemaIssue.Issue,
  path: readonly PropertyKey[]
): readonly (readonly PropertyKey[])[] => {
  switch (issue._tag) {
    case "Pointer": {
      return [[...path, ...issue.path]];
    }
    case "Composite":
    case "AnyOf": {
      return issue.issues.flatMap((inner) => pointedPaths(inner, path));
    }
    case "Encoding": {
      return pointedPaths(issue.issue, path);
    }
    case "Filter":
    case "Forbidden":
    case "InvalidType":
    case "InvalidValue":
    case "MissingKey":
    case "OneOf":
    case "UnexpectedKey": {
      return [];
    }
  }
};

interface Hooks {
  readonly leafHook?: LeafHook | undefined;
  readonly checkHook?: CheckHook | undefined;
}

type Emit = (path: readonly Segment[], message: string) => void;
type Walk = (issue: SchemaIssue.Issue, path: readonly PropertyKey[]) => void;

// Effect's own message for an issue it formats with no hook, at `path`.
const emitDefault = (
  issue: SchemaIssue.Issue,
  path: readonly PropertyKey[],
  emit: Emit
) => {
  for (const formatted of effectFormatter(issue).issues) {
    emit([...path, ...(formatted.path ?? [])], formatted.message);
  }
};

const walkFilter = (
  issue: SchemaIssue.Filter,
  path: readonly PropertyKey[],
  hooks: Hooks,
  emit: Emit,
  walk: Walk
): void => {
  const pointed = pointedPaths(issue.issue, path);
  const annotated = findMessage(issue.issue) ?? findMessage(issue);
  if (annotated !== undefined) {
    for (const target of pointed.length > 0 ? pointed : [path]) {
      emit(target, annotated);
    }
    return;
  }
  // A check that points at fields carries its own messages there ({ path, issue }), so the
  // caller's hook doesn't replace them.
  if (pointed.length > 0) {
    walk(issue.issue, path);
    return;
  }
  const hooked = hooks.checkHook?.(issue);
  if (hooked !== undefined) {
    emit(path, hooked);
  } else if (issue.issue._tag === "InvalidValue") {
    emitDefault(issue, path, emit);
  } else {
    walk(issue.issue, path);
  }
};

/**
 * Every issue in a decode failure, as Effect's Standard Schema formatter walks them, but with the
 * message chosen in this order: the Schema's annotation, then the caller's hook, then Effect's
 * default. A check that carries a `message` annotation and points at a sub-path keeps that path;
 * Effect's formatter would report it at the check's own path.
 */
export const toPathIssues = (
  issue: SchemaIssue.Issue,
  hooks: Hooks
): readonly PathIssue[] => {
  const out: PathIssue[] = [];
  const emit: Emit = (path, message) => {
    out.push({ message, path: normalize(path) });
  };
  const walk: Walk = (current, path) => {
    switch (current._tag) {
      case "Filter": {
        walkFilter(current, path, hooks, emit, walk);
        return;
      }
      case "Encoding": {
        walk(current.issue, path);
        return;
      }
      case "Pointer": {
        walk(current.issue, [...path, ...current.path]);
        return;
      }
      case "Composite":
      case "AnyOf": {
        if (current.issues.length === 0) {
          emitDefault(current, path, emit);
        }
        for (const inner of current.issues) {
          walk(inner, path);
        }
        return;
      }
      case "Forbidden":
      case "InvalidType":
      case "InvalidValue":
      case "MissingKey":
      case "OneOf":
      case "UnexpectedKey": {
        emit(
          path,
          findMessage(current) ??
            hooks.leafHook?.(current) ??
            SchemaIssue.defaultLeafHook(current)
        );
      }
    }
  };
  walk(issue, []);
  return out;
};
