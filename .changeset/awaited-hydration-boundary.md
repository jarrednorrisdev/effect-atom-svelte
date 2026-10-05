---
"effect-atom-svelte": patch
---

A `HydrationBoundary` whose `state` is awaited in markup no longer makes Svelte's dev build throw "Batch has scheduled effects" while hydrating an atom wrapped by `Atom.withReactivity`. A hook no longer schedules an update for the value its own first read computed before the component mounts (JND-95).
