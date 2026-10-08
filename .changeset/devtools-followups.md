---
"effect-atom-svelte": patch
"effect-atom-svelte-devtools": patch
---

The devtools no longer carry a mapped atom's value across a hot reload: `Atom.make(1).pipe(Atom.map(...))` wrote its mapped value back into its source, so set to 5 it read 10, then 20 after the reload. Only pipes that leave an atom holding what is written to it (`keepAlive`, `autoDispose`, `setIdleTTL`, `withLabel`, `serializable`) keep their value.

Atoms declared in a SvelteKit route group, such as `src/routes/(app)/+page.svelte`, now show and open their real file. The panel follows a `shortcut` prop the app changes after it has saved its settings, including settings saved by earlier versions. `atomLabels()` no longer warns that components aren't labelled when it comes after vite-plugin-svelte 7, which labels them.

The inspector no longer reports a computation as `Refreshed` when an earlier refresh changed nothing and a parent changed since.
