/**
 * Type-level checks, run by `bun run check` (svelte-check). Nothing here executes: the hooks need a
 * component, so each check is a function that is never called.
 */
import type { Exit } from "effect";
import { Atom } from "effect/reactivity";
import type { AsyncResult, AtomRegistry } from "effect/reactivity";
import { expectTypeOf } from "vitest";

import {
  provideRegistry,
  useAtomSet,
  useAtomSubscribe,
  useAtomSuspense,
} from "../src/index.ts";
import type { AtomValue, WriteMode } from "../src/index.ts";

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
