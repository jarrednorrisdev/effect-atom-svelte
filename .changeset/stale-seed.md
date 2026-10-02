---
"effect-atom-svelte": patch
---

A serializable atom no longer comes back with an old value. A value fetched in the browser after client-side navigation, or a hydration seed that arrived after every component using it was removed, was kept as a seed and applied the next time the atom was used, with no refetch. Now only the server's value seeds the atom, and only while a component is still there to use it. A component removed while waiting for a seed also no longer reads its atom once the seed arrives (JND-37).
