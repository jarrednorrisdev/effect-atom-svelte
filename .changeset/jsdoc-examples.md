---
"effect-atom-svelte": patch
---

Every hook and function now has a short example in its JSDoc, in Effect's `**Example** (Title)` style, so editors show one on hover (JND-75). The JSDoc also keeps to one word per concept: "unmounted" and "disposed of", "run again" for recomputing an atom ("fetch" only for network requests), "server rendering" rather than "SSR" and "markup" rather than "template" (JND-72).
