import { Atom } from "effect/reactivity";

/** Stands in for `Atom.kvs` over `localStorage`: "a" on the server, "b" in the browser. */
export const savedFilterAtom = Atom.make(() => "b").pipe(
  Atom.withServerValue(() => "a")
);
