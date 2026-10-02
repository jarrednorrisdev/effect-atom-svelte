---
"effect-atom-svelte": patch
---

`useAtomSuspense` with a getter and a serialization key no longer gets stuck on its server-rendered result after hydration, and no longer fetches the hydrated atom again in the browser. Hooks that follow a getter no longer recompute the previous atom after a switch (JND-23).
