---
"effect-atom-svelte": minor
---

`useAtomRef` and `useAtomRefPropValue` return a `current` you can assign for a writable `AtomRef`, which sets the ref or the property, so `bind:value={name.current}` works as it does with `useAtom`. A read-only ref, such as one from `map`, still returns a read-only `current`.
