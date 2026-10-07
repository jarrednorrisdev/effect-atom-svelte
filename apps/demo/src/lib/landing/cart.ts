import { Atom } from "effect/reactivity";

// Defined once, in a plain module. Each registry keeps its own values.
export const cartAtom = Atom.make(0);

// Derived in the module too: no component or context in between.
export const freeShippingAtom = Atom.make((get) => get(cartAtom) >= 3);
