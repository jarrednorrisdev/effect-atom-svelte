import { Atom } from "effect/reactivity";

import { currentUser } from "./session.ts";

// Your Effect code: an Effect<User, SignedOut>.
export const userAtom = Atom.make(currentUser);
