---
"effect-atom-svelte": patch
---

`useAtomResult` and `useAtomSuspense` now interrupt a serializable atom's request when the component goes away before it lands, as they already did for other atoms. After client-side navigation, a serializable atom (such as an `AtomRpc` or `AtomHttpApi` query) used to keep fetching until its request finished (JND-57).
