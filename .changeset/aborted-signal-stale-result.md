---
"effect-atom-svelte": patch
---

Fix `useAtomSet`'s `promise` and `promiseExit` modes settling a call whose signal was already aborted with the result of an earlier call. When the `Atom.fn` already held a settled result, the call resolved with that result instead of settling as interrupted. It now settles as interrupted whatever the atom holds, as the docs say.
