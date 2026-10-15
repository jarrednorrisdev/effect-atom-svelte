// Builds a form engine from the public options. Internal: not exported from the package.
import { Atom } from "effect/reactivity";
import type { AsyncResult, AtomRegistry } from "effect/reactivity";

import { Engine } from "./engine.ts";
import type { Definition, EngineOptions } from "./types.ts";

/** An engine for a form definition, from the options `useForm` and `Form.instance` take. */
export const engineOf = (
  form: { readonly definition: Definition },
  options: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly initialValues: unknown;
    readonly validates: boolean;
    readonly id: string;
    readonly values?: Atom.Writable<unknown> | undefined;
    readonly submit?:
      | { readonly atom: unknown; readonly payload?: unknown }
      | undefined;
    readonly mapError?: unknown;
    readonly autoSubmit?: boolean | undefined;
    readonly resetOnSuccess?: boolean | undefined;
  }
): Engine => {
  const { submit } = options;
  const atom = submit?.atom;
  const getAtom =
    typeof atom === "function" && !Atom.isAtom(atom) ? atom : () => atom;
  return new Engine(form.definition, {
    autoSubmit: options.autoSubmit,
    id: options.id,
    initialValues: options.initialValues,
    // SAFETY: the overloads of useForm and Form.instance type mapError as taking the submit atom's
    // error and returning errors for the form's values.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the implementation signatures can't carry the overloads' types
    mapError: options.mapError as EngineOptions["mapError"],
    registry: options.registry,
    resetOnSuccess: options.resetOnSuccess,
    submit:
      submit === undefined
        ? undefined
        : {
            // SAFETY: the overloads type the submit atom as a writable AsyncResult atom, or a
            // function returning one; anything else that is a function is the second.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a typeof check can't recover the function's signature
            atom: getAtom as () => Atom.Writable<
              AsyncResult.AsyncResult<unknown, unknown>,
              unknown
            >,
            // SAFETY: the overloads type payload as a function of the decoded values and the
            // submit's arguments.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the implementation signatures can't carry the overloads' types
            payload: submit.payload as
              | ((decoded: unknown, args: unknown) => unknown)
              | undefined,
          },
    validates: options.validates,
    values: options.values,
  });
};

/**
 * The function that computes a form's initial values, when `initialValues` is one rather than the
 * values themselves.
 */
export const initialGetter = (initial: unknown): (() => unknown) | undefined =>
  // SAFETY: the overloads type initialValues as the values or a function of no arguments that
  // returns them, so a function here is the second.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a typeof check can't recover the function's signature
  typeof initial === "function" ? (initial as () => unknown) : undefined;
