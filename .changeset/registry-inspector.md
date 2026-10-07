---
"effect-atom-svelte": minor
---

Add `effect-atom-svelte/inspector`, for developer tools. `inspect(registry)` reports what a registry does to its atoms: each node added and removed, each computation and why it ran (first read, a parent changed, a refresh), each new value and where it came from, readers coming and going, interruptions and finalizers. `registries()` and `watchRegistries` list the registries an app's providers hold, in the browser during development. A registry nobody inspects runs as before, and production builds don't list registries. The API is unstable.
