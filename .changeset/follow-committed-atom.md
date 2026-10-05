---
"effect-atom-svelte": patch
---

Hooks that follow a getter keep following the atom the last commit picked. After a switch abandoned while pending, a render with the switches rolled back could read an older atom last, leaving the hook subscribed to it, so the picked atom's refreshes, failures included, never reached the page or the boundary (JND-93).
