---
"effect-atom-svelte": patch
---

A reader whose atom is built for the first time by its own read, after the component has mounted, no longer updates a second time with the value it just read. `useAtomValue(() => family(id), transform)` ran the transform twice when `id` switched to an atom not built yet, returning a new object for an unchanged value; an `$effect` that first read an atom ran twice; and code after awaiting `useAtomSuspense` of an atom that resolves at once, in an `$effect`, ran twice.
