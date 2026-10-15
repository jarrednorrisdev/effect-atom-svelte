// Waiting for a write to an async atom to settle, for useAtomSet's promise modes and a form's
// submit. Internal: not exported from the package.
import { Effect, Exit } from "effect";
import type { Cause } from "effect";
import { AsyncResult } from "effect/reactivity";
import type { Atom, AtomRegistry } from "effect/reactivity";

/**
 * A promise-mode setter's wait: as `awaitResult` with `suspendOnWaiting`, but a change to a result
 * from before the call, which is what `Atom.Reset` from another setter leaves (an idle `Initial`,
 * or an `Atom.fn`'s `initialValue`), ends it as interrupted. The reset interrupts the call, so
 * otherwise the wait would hang until the next call, or settle with the initial value.
 */
export const awaitWrite = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  start: number,
  signal: AbortSignal
): Promise<Exit.Exit<A, E | Cause.NoSuchElementError>> =>
  Effect.runPromiseExit(
    Effect.callback<A, E | Cause.NoSuchElementError>((resume) => {
      const first = registry.get(atom);
      if (first._tag !== "Initial" && !first.waiting) {
        resume(AsyncResult.toExit(first));
        return;
      }
      const cancel = registry.subscribe(atom, (result) => {
        if (result.waiting) {
          return;
        }
        cancel();
        const reset =
          result._tag === "Initial" ||
          (result._tag === "Success" && result.timestamp < start);
        resume(reset ? Exit.interrupt() : AsyncResult.toExit(result));
      });
      return Effect.sync(cancel);
    }),
    { signal }
  );
