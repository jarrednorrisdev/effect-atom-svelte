---
"effect-atom-svelte": patch
---

`useAtomResult` accepts a getter (`() => atom`) like the other hooks. Only the first atom is awaited and seeded for hydration; when the getter picks another atom, the handle follows it without re-running the component's await (JND-18).
