// Types shared by the form engine's modules. Internal: not exported from the package.
import type { Cause, Option, Schema } from "effect";
import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import type { CheckHook, LeafHook } from "./issues.ts";
import type { IndexPath, Keys } from "./paths.ts";

/**
 * When a field's error shows: as the user types, when they leave it, or only on submit. The Schema
 * checks every change whatever the timing.
 */
export type Timing = "submit" | "blur" | "input";

/** Where an error came from, which decides when it clears. */
export type ErrorSource = "schema" | "submit" | "manual";

/** Errors to put on a form: per top-level field, per path, and form-level. */
export interface ErrorsInput {
  readonly fields?: Readonly<Record<string, string | undefined>> | undefined;
  readonly paths?:
    | readonly (readonly [IndexPath | string, string])[]
    | undefined;
  readonly form?: string | undefined;
}

/** A definition's settings, shared by every instance. */
export interface Definition {
  readonly schema: Schema.Top;
  /**
   * The form's name, for its atoms' labels (`SignUp.values`). Writable: the devtools' Vite plugin
   * fills it in from the variable a definition is declared as, when `Form.make` was given none.
   */
  name: string | undefined;
  /** An `Atom.AtomRuntime`, kept untyped: only its `fn` is used. */
  readonly runtime?: unknown;
  readonly validateOn: Timing;
  readonly revalidateOn: Timing;
  readonly debounce: number;
  readonly leafHook?: LeafHook | undefined;
  readonly checkHook?: CheckHook | undefined;
}

/** One instance's settings. */
export interface EngineOptions {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly id: string;
  readonly initialValues: unknown;
  readonly values?: Atom.Writable<unknown> | undefined;
  readonly submit?:
    | {
        readonly atom: () => Atom.Writable<
          AsyncResult.AsyncResult<unknown, unknown>,
          unknown
        >;
        readonly payload?:
          | ((decoded: unknown, args: unknown) => unknown)
          | undefined;
      }
    | undefined;
  readonly mapError?: ((error: unknown) => ErrorsInput | undefined) | undefined;
  readonly autoSubmit?: boolean | undefined;
  readonly resetOnSuccess?: boolean | undefined;
  /** Whether validation runs at all: not while rendering on the server. */
  readonly validates: boolean;
}

export interface ExternalError {
  readonly message: string;
  readonly source: "submit" | "manual";
}

/** An instance's state, in one atom. Error maps are keyed by `pathId` of a key path. */
export interface State {
  readonly initial: unknown;
  readonly keys: Keys;
  readonly touched: ReadonlySet<string>;
  /** Schema errors on show, by path. A path drops out once its check passes. */
  readonly revealed: ReadonlySet<string>;
  /** Paths that have shown an error since the last reset: they follow `revalidateOn`. */
  readonly shown: ReadonlySet<string>;
  /** The latest validation run's messages, in the Schema's order. */
  readonly issues: ReadonlyMap<string, string>;
  /** The values that run decoded, to tell whether its result is current. */
  readonly checked: unknown;
  readonly decoded: Option.Option<unknown>;
  /** Why the latest run couldn't decode at all (a defect, a runtime that failed), if it couldn't. */
  readonly failure: Cause.Cause<unknown> | undefined;
  readonly validating: boolean;
  readonly external: ReadonlyMap<string, ExternalError>;
  readonly submitCount: number;
  readonly validationCount: number;
  readonly submitting: boolean;
  readonly submitResult: AsyncResult.AsyncResult<unknown, unknown>;
  readonly lastSubmitted: Option.Option<{
    readonly encoded: unknown;
    readonly decoded: unknown;
  }>;
}
