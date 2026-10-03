---
"effect-atom-svelte": patch
---

`useAtomSubscribe` with `immediate` no longer subscribes again, and calls its callback again, when reactive state read inside the callback changes (JND-57).
