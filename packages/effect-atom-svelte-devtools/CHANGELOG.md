# effect-atom-svelte-devtools

## 0.2.2

### Patch Changes

- 73101b0: The devtools no longer carry a mapped atom's value across a hot reload: `Atom.make(1).pipe(Atom.map(...))` wrote its mapped value back into its source, so set to 5 it read 10, then 20 after the reload. Only pipes that leave an atom holding what is written to it (`keepAlive`, `autoDispose`, `setIdleTTL`, `setLazy`, `withEquality`, `withLabel`, `serializable`, `withServerValue`, `withServerValueInitial`) keep their value.

  Atoms declared in a SvelteKit route group, such as `src/routes/(app)/+page.svelte`, now show and open their real file, including those labelled with `Atom.withLabel`. The panel follows a `shortcut` prop the app changes after it has saved its settings, including settings saved by earlier versions, and keeps a shortcut chosen in the settings even when it is the default. A comment that mentions `<svelte:head>` before a component's script no longer stops its atoms being labelled. `atomLabels()` no longer warns that components aren't labelled when it comes after vite-plugin-svelte 7, which labels them.

  The inspector no longer reports a computation as `Refreshed` when an earlier refresh changed nothing and a parent changed since.

- 781e948: A failed atom's sheet now shows what it failed with, fields and all, such as `CityNotFound { city: "Atlantis" }`, above the full cause. Sheets write `NaN`, `Infinity` and `undefined` fields as they are instead of showing `null` or dropping the field. A map whose keys are objects, or whose keys read the same as strings (`1` and `"1"`), is shown as `[key, value]` pairs so no entry is lost, and a map, set or object over 50 entries now says how many more it has, as arrays already did.

  Clear empties the timeline while it is paused. The timeline's "only this atom" filter is dropped when the panel switches to another registry, instead of picking an unrelated atom there. The graph keeps the selected atom marked when the graph's layout changes.

- f6f0c9c: Fix several things `effect-atom-svelte/inspector` reported wrongly. A lazy atom no longer names a parent as the cause of its next computation when that parent changed while the atom was computing, before the atom read it. A node with an initial value (`initialValues`) that hasn't computed yet reports its first computation as a first read. A node removed after its idle TTL reports its interruption and finalizers before its removal, as other removals do. `registry.reset` reports the readers it drops. In a scope, a component reading a serializable atom whose node another atom object with the same key made (as after a hot reload) points at that node. The docs now say a refresh signal (`refreshOnWindowFocus`, `makeRefreshOnSignal`, `swr`) is reported as `Refreshed`, as it always was.

  Fix the devtools labelling a component with a `generics` attribute holding `>` wrongly, and taking a `<script>` inside `<svelte:head>` for the component's script: an inline head script got an `import` that broke the page, and a JSON-LD script stopped the component's atoms being labelled. A shortcut recorded with a key whose code has several words (`ArrowUp`, `PageDown`, `BracketLeft`) now opens the panel once saved, and is shown as such rather than as `Arrowup`. The graph puts both sides of a diamond to the right of its source whichever atom a scope lists first.

- 073fbdf: Fix `atomLabels` treating some scripts in a component as its own:

  - A `<script>` in the markup (inside an element or a block, such as JSON-LD or an inline analytics snippet) is left alone as page HTML. Before, it could stop the component's atoms being labelled, receive the component-naming import (a `SyntaxError` when the page loads), or have its calls wrapped in the label helper (a `ReferenceError`).
  - A comment in `<script module>` that mentions `<svelte:head>` no longer stops the instance script's atoms being labelled.

- Updated dependencies [72bc355]
- Updated dependencies [73101b0]
- Updated dependencies [85be511]
- Updated dependencies [7e2bc5c]
- Updated dependencies [63f9cfb]
- Updated dependencies [22a7551]
- Updated dependencies [c64799e]
- Updated dependencies [5d0a215]
- Updated dependencies [f6f0c9c]
- Updated dependencies [456cf7c]
- Updated dependencies [5c740ad]
- Updated dependencies [4208ce3]
- Updated dependencies [67d468b]
- Updated dependencies [876bdd1]
- Updated dependencies [dfd7db3]
- Updated dependencies [473c6e1]
- Updated dependencies [e0d92a1]
- Updated dependencies [c64799e]
- Updated dependencies [c01da28]
- Updated dependencies [85be511]
- Updated dependencies [4f0d922]
  - effect-atom-svelte@0.3.0

## 0.2.1

### Patch Changes

- e22f35e: Add a `production` prop to `<AtomDevtools />`, for a site that shows the panel to its visitors, as the effect-atom-svelte docs now do. Without it the panel still renders nothing outside development. In production it shows the nearest provider's registry (or `registry`) with no picker, and declarations aren't links to the editor.

  The panel opens and closes with a keyboard shortcut, Alt+Shift+A by default (the `shortcut` prop sets another). A new Settings view changes the shortcut, and the button's corner, opacity and size; the button can also be dragged to another corner.

  The panel's and the graph's italic notes read `--font-serif` (the system serif without it) instead of asking for Libron by name, so all their fonts and colours come from CSS variables. `[data-atom-devtools]` sets them for the panel alone; the README's Theming section lists them.

  A failed atom says what it failed with: the graph shows its error's name (`Failure · CityNotFound`), and the timeline and sheets the error with its fields (`CityNotFound { city: "Atlantis" }`) rather than the first line of `Cause.pretty`. A defect shows as `defect: TypeError`, an interruption as `interrupted`.

## 0.2.0

### Minor Changes

- First release, alongside effect-atom-svelte 0.2.0, whose inspector it reads. It starts at 0.2.0 to match the effect-atom-svelte it goes with.
  - `<AtomDevtools />`: a panel docked along the bottom of the window that shows an atom registry live, with a dependency graph, a sheet per atom and a timeline of every computation, update, interruption and finalizer. Development only.
  - `atomLabels()` from `effect-atom-svelte-devtools/vite`: a Vite plugin that names atoms after their variables (and family members and factory calls after their arguments), names components for inspector scopes, and keeps state atoms' values across hot reloads. Dev server only, unless you ask for production builds too.
  - `effect-atom-svelte-devtools/graph`: the dependency graph the panel draws, as a layout and Svelte components you can use in your own pages.
