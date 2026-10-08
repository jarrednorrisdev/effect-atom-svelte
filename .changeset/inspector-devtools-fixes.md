---
"effect-atom-svelte": patch
"effect-atom-svelte-devtools": patch
---

Fix several things `effect-atom-svelte/inspector` reported wrongly. A lazy atom no longer names a parent as the cause of its next computation when that parent changed while the atom was computing, before the atom read it. A node with an initial value (`initialValues`) that hasn't computed yet reports its first computation as a first read. A node removed after its idle TTL reports its interruption and finalizers before its removal, as other removals do. `registry.reset` reports the readers it drops. In a scope, a component reading a serializable atom whose node another atom object with the same key made (as after a hot reload) points at that node. The docs now say a refresh signal (`refreshOnWindowFocus`, `makeRefreshOnSignal`, `swr`) is reported as `Refreshed`, as it always was.

Fix the devtools labelling a component with a `generics` attribute holding `>` wrongly, and taking a `<script>` inside `<svelte:head>` for the component's script: an inline head script got an `import` that broke the page, and a JSON-LD script stopped the component's atoms being labelled. A shortcut recorded with a key whose code has several words (`ArrowUp`, `PageDown`, `BracketLeft`) now opens the panel once saved, and is shown as such rather than as `Arrowup`. The graph puts both sides of a diamond to the right of its source whichever atom a scope lists first.
