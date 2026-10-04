import { Atom } from "effect/reactivity";

// The chat's messages. Like any atom, the registry keeps them only while
// something holds the atom.
export const messagesAtom = Atom.make<readonly string[]>([]);
