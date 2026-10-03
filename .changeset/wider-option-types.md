---
"effect-atom-svelte": patch
---

Option types accept wider values: `useAtomSet` takes `mode` typed as `WriteMode` or `undefined`, `useAtomSuspense` takes `includeFailure` typed as `boolean`, and `useAtomSubscribe` takes `immediate: undefined` (JND-57).
