import { Atom } from "effect/reactivity";

export const countAtom = Atom.make(0);

export const doubleAtom = Atom.make((get) => get(countAtom) * 2).pipe(
  Atom.keepAlive
);

export const todoAtom = Atom.family((id: number) => Atom.make(id));

export const notAnAtom = String(1);
