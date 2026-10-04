import type { Atom } from "effect/reactivity";

import { moduleDraftAtom } from "./draft-scope.ts";

// For the examples' labels only: which editor provided an atom, looked up by the
// atom itself, so a label names the provider that Draft.use() really found.
const names = new WeakMap<Atom.Atom<string>, string>();

export const nameProvider = (atom: Atom.Atom<string>, name: string) => {
  names.set(atom, name);
};

export const providerOf = (atom: Atom.Atom<string>) =>
  atom === moduleDraftAtom ? "moduleDraftAtom" : (names.get(atom) ?? "?");
