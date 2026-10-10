---
"effect-atom-svelte": patch
---

Fix `useAtomSuspense` with `includeFailure` resolving, after it waited, with a copy of the atom's result rather than the result itself. The copy lost a `Failure`'s `previousSuccess`, so `AsyncResult.getOrElse` and `AsyncResult.value` no longer fell back to the last value. It showed in a promise awaited in the script or an event handler.
