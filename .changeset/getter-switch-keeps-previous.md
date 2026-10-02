---
"effect-atom-svelte": patch
---

A hook whose getter picks its atom from component `$state` or a prop no longer computes the previous atom once more after a switch. The previous atom stays subscribed until the switch commits (JND-35).
