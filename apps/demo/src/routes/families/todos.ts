import { Atom } from "effect/reactivity";

// One atom per todo, keyed by its id. The same id returns the same atom,
// so every component that calls todoAtom(id) shares that todo's state.
export const todoAtom = Atom.family((id: number) =>
  Atom.make({ done: false, id })
);
