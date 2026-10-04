import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

// Atom.make makes a new atom every time it is called. This call runs once, when
// the module loads, so every editor that gets this atom shares one draft.
export const moduleDraftAtom = Atom.make("");

// The function runs once for each editor that provides Draft. For "scoped", it
// calls Atom.make again, so each editor gets an atom of its own. For "module", it
// hands out the one atom above, as if the editors imported it.
export const Draft = ScopedAtom.make((kind: "scoped" | "module") =>
  kind === "scoped" ? Atom.make("") : moduleDraftAtom
);
