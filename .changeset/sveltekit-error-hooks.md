---
"effect-atom-svelte": minor
---

New `effect-atom-svelte/sveltekit` entry point with `handleClientError` and `handleServerError`, SvelteKit `handleError` hooks that keep an Effect error's `_tag` (and, in the browser, its message) for a `<svelte:boundary>` `failed` snippet, which otherwise only gets `"Internal Error"`. The server hook keeps SvelteKit's generic message so details of the server stay hidden (JND-31).
