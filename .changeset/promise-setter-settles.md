---
"effect-atom-svelte": patch
---

Fix pending `useAtomSet` calls and initial values in edge cases:

- A `"promise"` or `"promiseExit"` call no longer hangs when the `RegistryProvider` that created its registry is destroyed mid-call: the call is interrupted and the promise settles as interrupted. A registry you pass in yourself is still yours to dispose of.
- A `"promise"` or `"promiseExit"` call pending when another setter writes `Atom.Reset` settles as interrupted, instead of hanging, or resolving with the `initialValue` of an `Atom.fn` that has one. `Atom.Interrupt` remains the way to cancel a call.
- `useAtomInitialValues` lets go of the entries it applied when a later entry throws, so on the server a registry shared between requests no longer renders the failed request's value in the next one.
- A finalizer that throws while a `RegistryProvider` (or `provideRegistry` without a `registry`) disposes of its registry in the browser is reported as an uncaught error after teardown, instead of being thrown into Svelte's teardown, where it left every `$derived` on the page running again on every read until reload.
