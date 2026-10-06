---
"effect-atom-svelte": patch
---

Require Svelte 5.57.2 or later. It fixes event handlers assigned after a top-level `await`, which were `undefined` in production builds, so `onclick={refresh}` did nothing when a hook after the `await` returned `refresh`.
