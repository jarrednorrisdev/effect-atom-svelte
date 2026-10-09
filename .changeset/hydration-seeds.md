---
"effect-atom-svelte": patch
---

Fix four cases where server-rendered state reached the browser wrongly:

- Remounting a component that makes its own serializable atom, such as a `ScopedAtom` provider under `{#key}` with its input in the serialization key, no longer throws `Two different atoms share the serialization key`. Svelte sets up the new copy before it destroys the old one, so for a moment both hold the key. In the browser, two different atoms holding one key now warn in development instead of throwing; the server render still throws.
- The browser's first render inside a `HydrationBoundary` now matches the server's markup when the atom already exists, as with a value from `RegistryProvider`'s `initialValues` or an atom also read above the boundary. While the page hydrates, the boundary updates those atoms before its children render, as the server does. This needs Svelte's `experimental.async`; without it they are updated after the first render, as before. Each server-rendered page with a `HydrationBoundary` carries one more small `hydratable` entry for this.
- In the browser, a value dehydrated as a promise that lands after its `HydrationBoundary` is destroyed, including one destroyed while its children were still loading, is ignored, so it no longer reaches whoever reads the atom later. A reader that already held the atom when the boundary was destroyed, such as a layout's reader above it, still gets the value.
- A serializable atom read with `useAtomResult` or `useAtomSuspense` and also with `useAtomValue`, as by a badge rendered earlier in the page, is no longer fetched again in the browser as the page hydrates. The `useAtomValue` reader now waits for the server's result, showing `Initial`, waiting, until it lands.
