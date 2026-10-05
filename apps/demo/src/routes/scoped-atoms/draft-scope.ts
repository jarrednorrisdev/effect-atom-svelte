import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

// Draft.provide(initial) runs this once for each component that calls it, so
// every editor gets an atom of its own.
export const Draft = ScopedAtom.make((initial: string) => Atom.make(initial));
