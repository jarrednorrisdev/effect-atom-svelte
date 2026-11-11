---
"effect-atom-svelte": patch
"effect-atom-svelte-devtools": patch
---

Support Effect 4.1: the `effect` peer range is now `>=4.0.0 <4.2.0`. On 4.1, a server render waits for a value a `HydrationBoundary` brings as a promise, as it does on 4.0, instead of rendering the atom's `Initial`.
