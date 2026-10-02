import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

/** One counter atom per panel that provides it. */
export const Counter = ScopedAtom.make((start: number) => Atom.make(start));
