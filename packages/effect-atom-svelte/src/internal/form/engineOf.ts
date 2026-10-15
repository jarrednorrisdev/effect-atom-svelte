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
    readonly values?: unknown;
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
  return new Engine(form.definition, {
    autoSubmit: options.autoSubmit,
    id: options.id,
    initialValues: options.initialValues,
    mapError: options.mapError as EngineOptions["mapError"],
    registry: options.registry,
    resetOnSuccess: options.resetOnSuccess,
    submit:
      submit === undefined
        ? undefined
        : {
            atom: (typeof atom === "function" && !Atom.isAtom(atom)
              ? atom
              : () => atom) as () => Atom.Writable<
              AsyncResult.AsyncResult<unknown, unknown>,
              unknown
            >,
            payload: submit.payload as
              | ((decoded: unknown, args: unknown) => unknown)
              | undefined,
          },
    validates: options.validates,
    values: options.values as Atom.Writable<unknown> | undefined,
  });
};
