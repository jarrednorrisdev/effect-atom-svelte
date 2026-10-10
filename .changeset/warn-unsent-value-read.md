---
"effect-atom-svelte": patch
---

In development, the server now warns once per serialization key when `useAtomValue` or `useAtom` reads a serializable async atom. Only `useAtomResult` and `useAtomSuspense` send an atom's result to the browser, so that atom runs again there, which the page showed only as a second request. A value a `HydrationBoundary` brought, and an atom nothing has started, such as a mutation nobody has called, don't warn.
