---
"effect-atom-svelte": patch
---

`useAtomSuspense` no longer shows "All fibers interrupted without error" in the boundary's `failed` snippet when its getter switches atoms twice in a row while loading. An abandoned wait now rejects with Svelte's abort reason, which Svelte ignores, instead of the interruption (JND-22).
