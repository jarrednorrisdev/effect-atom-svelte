---
"effect-atom-svelte": patch
---

In development, the server now warns once per serialization key when `useAtomValue` or `useAtom` reads a serializable async atom that is still running. Only `useAtomResult` and `useAtomSuspense` send an atom's result to the browser, so that atom runs again there, which the page showed only as a second request. A key the page sends anyway, through one of those hooks in the same render or a `HydrationBoundary`, doesn't warn, nor does a result nothing is computing, such as a mutation nobody has called.
