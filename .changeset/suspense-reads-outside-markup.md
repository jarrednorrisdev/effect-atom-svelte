---
"effect-atom-svelte": patch
---

Fix two ways `useAtomSuspense` kept an atom loading after its component was destroyed, on a registry that outlives the component:

- Its promise read through a `$derived` that only the script or an event handler reads, as in `const todos = $derived(list.current)` awaited in a click handler. Svelte never aborts such a derived's signal, so the wait it held was never let go of. Each read now also lets go when the component is destroyed.
- Its promise read after the component was destroyed, as in `onDestroy` or a handler that resumes later. A result the component had already settled is still returned; one it would have to wait for now rejects with the abort reason, without starting the atom.
