---
"effect-atom-svelte": patch
---

`useAtomValue(atom, f)` keeps the transform's result until the atom or state `f` reads changes, so a transform that builds an object no longer returns a new one on every read. A promise-mode setter given an already aborted `signal` settles as interrupted without writing. `ScopedAtom.provide` can be called without an input when the factory's input is optional, and `ScopedAtom.TypeId` is exported as a type too (JND-25).
