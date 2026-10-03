---
"effect-atom-svelte": patch
---

`useAtomResult` and `useAtomSuspense` honour `Atom.withServerValue` on the server: the atom is read as its server value and never computed, mounted or passed to the browser. `useAtomSuspense` rejects when the server value is `Initial`, so read it inside a `<svelte:boundary>` with a `pending` snippet (JND-58).
