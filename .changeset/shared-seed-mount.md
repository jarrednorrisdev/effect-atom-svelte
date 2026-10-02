---
"effect-atom-svelte": patch
---

When several components use the same serializable atom, each one now keeps its hydrated value alive, not only the first. Before, destroying the first let the registry drop the value, and the others fetched it again in the browser (JND-36).
