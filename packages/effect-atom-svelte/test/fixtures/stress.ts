import { Effect } from "effect";
import type { AsyncResult } from "effect/reactivity";
import { Atom } from "effect/reactivity";

/** The atoms one stress test shares between its readers. */
export interface StressAtoms {
  /** Written by timers; read by the sync chain and the async chain. */
  readonly count: Atom.Writable<number>;
  readonly plusOne: Atom.Atom<number>;
  readonly doubled: Atom.Atom<number>;
  readonly label: Atom.Atom<string>;
  /** An async atom over the sync chain, then an async atom over that. */
  readonly delayed: Atom.Atom<AsyncResult.AsyncResult<number>>;
  readonly delayedLabel: Atom.Atom<AsyncResult.AsyncResult<string>>;
  /**
   * Written from a click handler and read by no async atom, so its batch has no pending work and
   * commits as soon as it is flushed.
   */
  readonly clicks: Atom.Writable<number>;
  readonly clicksLabel: Atom.Atom<string>;
  /**
   * A new atom for every count, read through a getter. A reader switching to one subscribes before
   * the atom is built, so building it notifies during the read: the path that has to be deferred.
   */
  readonly forCount: (count: number) => Atom.Atom<string>;
  readonly delayedForCount: (
    count: number
  ) => Atom.Atom<AsyncResult.AsyncResult<string>>;
}

/** Fresh atoms for one test, so no node outlives it. */
export const makeStressAtoms = (): StressAtoms => {
  const count = Atom.make(0);
  const plusOne = Atom.make((get) => get(count) + 1);
  const doubled = Atom.make((get) => get(plusOne) * 2);
  const label = Atom.make((get) => `${get(plusOne)}/${get(doubled)}`);
  // The delay varies with the value, so requests started in a burst finish out of order.
  const delayed = Atom.make((get) => {
    const value = get(doubled);
    return Effect.succeed(value).pipe(
      Effect.delay(`${(value % 7) * 3} millis`)
    );
  });
  const delayedLabel = Atom.make((get) =>
    get.result(delayed).pipe(Effect.map((value) => `d${value}`))
  );
  const clicks = Atom.make(0);
  const clicksLabel = Atom.make((get) => `c${get(clicks)}`);
  const forCount = Atom.family((n: number) =>
    Atom.make((get) => `f${n}/${get(plusOne)}`)
  );
  const delayedForCount = Atom.family((n: number) =>
    Atom.make(
      Effect.succeed(`df${n}`).pipe(Effect.delay(`${(n % 5) * 4} millis`))
    )
  );
  return {
    clicks,
    clicksLabel,
    count,
    delayed,
    delayedForCount,
    delayedLabel,
    doubled,
    forCount,
    label,
    plusOne,
  };
};
