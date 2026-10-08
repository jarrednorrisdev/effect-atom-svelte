import { Atom } from "effect/reactivity";

export const countAtom = Atom.make(1).pipe(Atom.withLabel("countAtom"));

// No label: plumbing, between countAtom and totalAtom.
const doubled = Atom.make((get) => get(countAtom) * 2);

export const totalAtom = Atom.make((get) => get(doubled) + 1).pipe(
  Atom.withLabel("totalAtom")
);
