---
"effect-atom-svelte": patch
---

Fix server renders leaving atoms held on a registry the caller keeps across requests when a `<svelte:boundary>` with a `failed` snippet caught an error thrown while its children set up. Svelte drops those children's `onDestroy` callbacks, so their mounts, holds and `useAtomInitialValues` values stayed, and the next request rendered the earlier request's initial value. The hooks and `HydrationBoundary` now also let go when the render ends.
