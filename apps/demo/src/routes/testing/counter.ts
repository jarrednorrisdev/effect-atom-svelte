import { Effect } from "effect";
import { Atom } from "effect/reactivity";

export const countAtom = Atom.make(0);

export const doubledAtom = Atom.make((get) => get(countAtom) * 2);

// Async: the total arrives a moment after the count changes.
export const savedAtom = Atom.make((get) =>
  Effect.succeed(`Saved ${get(countAtom)}`).pipe(Effect.delay("10 millis"))
);
