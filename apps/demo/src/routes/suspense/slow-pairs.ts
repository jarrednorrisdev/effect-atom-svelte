import { Effect } from "effect";
import { Atom } from "effect/reactivity";

// An atom that takes one second.
const slow = (value: string) =>
  Atom.make(Effect.succeed(value).pipe(Effect.delay("1 second")));

// A pair for each side of the example, so the two sides don't share a load.
export const oneByOne = { todosAtom: slow("todos"), userAtom: slow("user") };
export const together = { todosAtom: slow("todos"), userAtom: slow("user") };
