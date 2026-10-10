import { Effect } from "effect";
import { Atom } from "effect/reactivity";

export const countAtom = Atom.make(0);

export const doubledAtom = Atom.make((get) => get(countAtom) * 2);

// Async: the saved count arrives a moment after the count changes.
export const savedAtom = Atom.make((get) =>
  Effect.succeed(`Saved ${get(countAtom)}`).pipe(Effect.delay("10 millis"))
);

// A mutation: each call submits the count it is given.
export const submitAtom = Atom.fn((count: number) =>
  Effect.succeed(`Submitted ${count}`).pipe(Effect.delay("10 millis"))
);
