import { Atom } from "effect/reactivity";

export const countAtom = Atom.make(0);

export const doubleAtom = Atom.make((get) => get(countAtom) * 2).pipe(
  Atom.keepAlive
);

export const todoAtom = Atom.family((id: number) => Atom.make(id));

export const notAnAtom = String(1);

// The Families page's comparison: a family, and a Map that makes a new atom for every call.
const newDraft = () => Atom.make("").pipe(Atom.keepAlive);
export const draftAtom = Atom.family((_key: string) => newDraft());
export const mapDraftAtom = (_key: string) => newDraft();
export const fromMap = [mapDraftAtom("a"), mapDraftAtom("a")];
export const fromFamily = draftAtom("a");
