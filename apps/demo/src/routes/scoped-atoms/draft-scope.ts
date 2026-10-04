import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

// One draft for the whole app: every editor that reads it shares it.
export const sharedDraftAtom = Atom.make("");

// One draft per editor that provides it. The example's switch passes `shared`
// to show what happens with the module atom instead.
export const Draft = ScopedAtom.make((shared: boolean) =>
  shared ? sharedDraftAtom : Atom.make("")
);
