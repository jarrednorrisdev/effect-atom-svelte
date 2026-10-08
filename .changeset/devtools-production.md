---
"effect-atom-svelte-devtools": patch
---

Add a `production` prop to `<AtomDevtools />`, for a site that shows the panel to its visitors, as the effect-atom-svelte docs now do. Without it the panel still renders nothing outside development. In production it shows the nearest provider's registry (or `registry`) with no picker, and declarations aren't links to the editor.
