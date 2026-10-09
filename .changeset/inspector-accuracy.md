---
"effect-atom-svelte": patch
---

Make the inspector report more accurately, which the devtools show:

- An inspector scope's snapshot and `ScopeChanged` follow an atom in the scope that switches what it reads, also when it mounts, subscribes to or writes another atom while computing, and also while nothing listens to the scope.
- `Interrupted` (a cross in the devtools) is reported only for the effect atom whose fiber was interrupted, not also for a wrapper passing its result on, such as `Atom.debounce`, `makeRefreshOnSignal` or `refreshOnWindowFocus`, and not for an `Atom.runtime` released while its layer builds, which carries on.
- `idleTTL` gives `undefined` for an atom with an idle TTL of 0, which is removed as soon as nothing reads it.
