---
"effect-atom-svelte": patch
---

Abandoned async reads no longer keep their atom loading. When a `useAtomSuspense` getter switches atoms while the old one is pending, or the component unmounts, the old atom is disposed and its request interrupted; the same goes for `await useAtomResult(...)` in a component removed before the result arrives (JND-16).
