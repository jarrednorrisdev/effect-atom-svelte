---
"effect-atom-svelte": minor
---

Add `effect-atom-svelte/inspector`, for developer tools. `inspect(registry)` reports what a registry does to its atoms: each node added and removed, each computation and why it ran (first read, a parent changed, a refresh), each new value and where it came from, readers coming and going, interruptions and finalizers. `registries()` and `watchRegistries` list the registries an app's providers hold, in the browser during development. `provideInspectorScope()` makes a part of the component tree a scope: the hooks below it report the atoms they use, and the scope shows those atoms, everything upstream of them and the hooks, with events for just those atoms; it works in production too, for pages that draw their own atoms. `nameComponent(name, file)` names a component for the scopes its hooks report to. A registry nobody inspects runs as before, and production builds don't list registries. The API is unstable.
