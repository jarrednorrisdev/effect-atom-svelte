---
"effect-atom-svelte": patch
---

Fix a hook whose getter switches atoms in `onMount` computing the atom it left again. The hook released the old atom before Svelte had committed the switch, so the registry could sweep it while renders still read it, and they built it afresh, re-running its effect. The old atom is now kept until a later commit picks another.
