---
"effect-atom-svelte": patch
---

Fix two cases where the server ran an atom that had a value from `useAtomInitialValues`, which renders that value instead so that a browser-only read or a request the value was there to save doesn't run:

- An atom wrapped by `Atom.withRefresh`, `Atom.withReactivity`, `Atom.swr`, `Atom.debounce` or `Atom.makeRefreshOnSignal`, or an `AtomRpc` or `AtomHttpApi` query with `reactivityKeys`. The value goes to the wrapped atom, and every hook now renders it from there.
- A serializable atom read with `useAtomSuspense` and awaited in the markup straight away.
