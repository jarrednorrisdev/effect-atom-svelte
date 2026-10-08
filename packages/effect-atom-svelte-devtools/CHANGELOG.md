# effect-atom-svelte-devtools

## 0.2.0

### Minor Changes

- First release, alongside effect-atom-svelte 0.2.0, whose inspector it reads. It starts at 0.2.0 to match the effect-atom-svelte it goes with.
  - `<AtomDevtools />`: a panel docked along the bottom of the window that shows an atom registry live, with a dependency graph, a sheet per atom and a timeline of every computation, update, interruption and finalizer. Development only.
  - `atomLabels()` from `effect-atom-svelte-devtools/vite`: a Vite plugin that names atoms after their variables (and family members and factory calls after their arguments), names components for inspector scopes, and keeps state atoms' values across hot reloads. Dev server only, unless you ask for production builds too.
  - `effect-atom-svelte-devtools/graph`: the dependency graph the panel draws, as a layout and Svelte components you can use in your own pages.
