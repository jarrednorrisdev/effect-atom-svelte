import { Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";

export const draftAtom = Atom.make("");
export const historyAtom = Atom.make<readonly string[]>([]);

// Plain code with no component around it, so no hooks: it reads and writes
// through the registry it is given.
export const save = (registry: AtomRegistry.AtomRegistry) => {
  const draft = registry.get(draftAtom);
  registry.update(historyAtom, (history) => [...history, draft]);
  registry.set(draftAtom, "");
};
