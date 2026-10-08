---
"effect-atom-svelte": patch
---

`handleClientError` and `handleServerError` now type-check as SvelteKit 2's `HandleClientError` and `HandleServerError`, whose `App.Error` requires a message: given SvelteKit 2's input, which has no `kind`, they are typed to return one, as they always set one there. `handleClientError` also uses SvelteKit 2's message for an error whose own message is empty, such as a `Data.TaggedError`.

The docs now say that SvelteKit 2 runs errors in a boundary through `handleError` only with `kit.experimental.handleRenderingErrors`, and use SvelteKit 3's `#lib` in their imports.
