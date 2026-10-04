import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

// Created once, when this module first loads. There is only ever this one
// atom, so every editor that is given it shares the same draft.
export const moduleDraftAtom = Atom.make("");

// Created separately for each editor: Draft.provide() runs this function once per
// editor, and for "scoped" each run calls Atom.make again, making a new atom.
// For "module", it hands out the one atom above, as if the editors imported it.
export const Draft = ScopedAtom.make((kind: "scoped" | "module") =>
  kind === "scoped" ? Atom.make("") : moduleDraftAtom
);
