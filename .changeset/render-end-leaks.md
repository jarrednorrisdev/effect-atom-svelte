---
"effect-atom-svelte": patch
---

Fix two more ways a server render could keep atoms after a `<svelte:boundary>` with a `failed` snippet caught an error thrown while its children set up:

- A dropped component whose script awaits before calling its hooks now lets go of its atoms on a registry the caller keeps across requests. Its script resumed after the render had ended, so its atoms stayed held and the next request rendered this one's initial value.
- A `RegistryProvider` without a `registry` prop inside such a boundary now disposes its registry on the server, so its `keepAlive` atoms, and whatever they run, no longer outlive the request.

A `useAtomValue` reader kept past the render no longer keeps the atom its getter switches to mounted on a registry the caller keeps.
