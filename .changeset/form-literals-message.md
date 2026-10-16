---
"effect-atom-svelte": patch
---

Form: `leafHook` now names a value outside a union, such as a select whose value isn't one of its `Schema.Literals`. It used to get Effect's own `Expected "a" | "b"` whatever the hook returned. The hook receives it as an `InvalidType` whose `ast` is the union, as it already did for a single `Schema.Literal`.
