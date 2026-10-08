/**
 * Type-level checks, run by `bun run check` (svelte-check). Nothing here executes: the hooks need a
 * component, so each check is a function that is never called.
 */
import type { Exit } from "effect";
import { Atom } from "effect/reactivity";
import type { AsyncResult, AtomRegistry } from "effect/reactivity";
import { expectTypeOf } from "vitest";

import {
  ScopedAtom,
  provideRegistry,
  useAtomSet,
  useAtomSubscribe,
  useAtomSuspense,
} from "../src/index.ts";
import type { AtomValue, WriteMode } from "../src/index.ts";
import { handleClientError, handleServerError } from "../src/SvelteKit.ts";

declare const count: Atom.Writable<number>;
declare const save: Atom.Writable<
  AsyncResult.AsyncResult<string, Error>,
  number
>;
declare const query: Atom.Atom<AsyncResult.AsyncResult<string, Error>>;
declare const registry: AtomRegistry.AtomRegistry;

// Options typed as wider values, or explicitly undefined, are accepted under
// exactOptionalPropertyTypes (JND-57).
export const optionTypes = (mode: WriteMode, includeFailure: boolean) => {
  expectTypeOf(useAtomSet(count, { mode: undefined })).toEqualTypeOf<
    (value: number | ((current: number) => number)) => void
  >();
  const set = useAtomSet(save, { mode });
  expectTypeOf(set).returns.toEqualTypeOf<
    undefined | Promise<string> | Promise<Exit.Exit<string, Error>>
  >();
  expectTypeOf(useAtomSuspense(query, { includeFailure })).toEqualTypeOf<
    AtomValue<
      Promise<
        | string
        | AsyncResult.Success<string, Error>
        | AsyncResult.Failure<string, Error>
      >
    >
  >();
  useAtomSubscribe(count, () => undefined, { immediate: undefined });
};

declare const mutation: Atom.AtomResultFn<number, string, Error>;

// Atom.Reset never settles a promise-mode wait, so only value mode accepts it.
export const resetTypes = () => {
  useAtomSet(mutation)(Atom.Reset);
  // @ts-expect-error -- a reset result is Initial, which a promise-mode setter would wait on forever
  void useAtomSet(mutation, { mode: "promise" })(Atom.Reset);
  // @ts-expect-error -- as in promise mode
  void useAtomSet(mutation, { mode: "promiseExit" })(Atom.Reset);
  void useAtomSet(mutation, { mode: "promise" })(1);
};

// The AtomRegistry.make options apply only to a registry the provider creates (JND-61).
export const providerOptions = () => {
  provideRegistry({ registry, revalidateOnHydrate: true });
  provideRegistry({ initialValues: [[count, 1]], revalidateOnHydrate: true });
  // @ts-expect-error -- an existing registry takes no options for a new one
  provideRegistry({ initialValues: [[count, 1]], registry });
};

// A factory whose input is optional can be provided without one; a required input stays required.
// The type id is exported as a type too, as Effect's modules do (JND-25).
export const scopedAtomTypes = () => {
  const Optional = ScopedAtom.make((start?: number) => Atom.make(start ?? 0));
  Optional.provide();
  Optional.provide(1);
  const Required = ScopedAtom.make((start: number) => Atom.make(start));
  Required.provide(1);
  // @ts-expect-error -- the input is required
  Required.provide();
  const None = ScopedAtom.make(() => Atom.make(0));
  None.provide();
  expectTypeOf(None[ScopedAtom.TypeId]).toEqualTypeOf<ScopedAtom.TypeId>();
};

// The error hooks fit SvelteKit 2's handleError, whose input has no `kind` and whose App.Error
// requires a message, and SvelteKit 3's, whose App.Error does not.
interface Kit2Input {
  readonly error: unknown;
  readonly event: unknown;
  readonly status: number;
  readonly message: string;
}
interface Kit3Input {
  readonly error: unknown;
  readonly event: unknown;
  readonly status: number;
  readonly kind: "unknown" | "app" | "framework";
}
type Kit2Hook = (
  input: Kit2Input
) => undefined | { readonly message: string; readonly tag?: string };
type Kit3Hook = (
  input: Kit3Input
) => undefined | { readonly message?: string; readonly tag?: string };

export const sveltekitHooks = () => {
  expectTypeOf(handleClientError).toExtend<Kit2Hook>();
  expectTypeOf(handleServerError).toExtend<Kit2Hook>();
  expectTypeOf(handleClientError).toExtend<Kit3Hook>();
  expectTypeOf(handleServerError).toExtend<Kit3Hook>();
};
