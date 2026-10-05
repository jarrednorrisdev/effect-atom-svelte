---
"effect-atom-svelte": patch
---

In development, `useAtomResult` and `useAtomSuspense` warn when they miss the server's result for a serializable atom because they were called after a top-level `await` in the component's script, where Svelte has stopped hydrating (JND-96).
