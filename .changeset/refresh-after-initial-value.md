---
"effect-atom-svelte": patch
---

Fix the first refresh of an atom with a value from `initialValues` or `useAtomInitialValues` being lost after the server's result or a `HydrationBoundary` value replaced that value: the atom ran again, but kept showing the old value, and `revalidateOnHydrate` did nothing for it. This includes an atom wrapped by `Atom.withRefresh` or similar, whose initial value goes to the atom it wraps. Effect's registry kept the initial value through the next computation even though the atom had a value of its own by then.
