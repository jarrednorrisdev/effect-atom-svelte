---
"effect-atom-svelte": patch
---

In the browser, a serializable atom is no longer kept alive for the registry's lifetime after its components are gone, and a new atom object with the same serialization key (an atom created inside a component, or one re-created by HMR) no longer throws "Two different atoms share the serialization key" once the previous one is unused. Two different atoms in use at once with one key still throw (JND-60).
