# effect-atom-svelte-devtools

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
