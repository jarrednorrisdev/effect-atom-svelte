---
"effect-atom-svelte": patch
---

When the getter passed to `useAtomResult` or `useAtomSuspense` switches away from a serializable atom, the hook no longer keeps that atom mounted, running and refetching on its reactivity keys until the component is destroyed. Repeated `useAtomSuspense` reads outside a reaction no longer add an abort listener each (JND-59).
