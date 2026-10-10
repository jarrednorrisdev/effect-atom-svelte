---
"effect-atom-svelte": patch
---

A server render that fails while a serializable atom's result is still being prepared for the browser no longer reports an unhandled rejection ("registry is disposed"). The provider disposes of its registry when the failed render ends, and the pending result now stops there instead of reading from it.
