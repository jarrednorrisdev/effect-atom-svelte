---
"effect-atom-svelte-devtools": patch
---

Fix `atomLabels` treating some scripts in a component as its own:

- A `<script>` in the markup (inside an element or a block, such as JSON-LD or an inline analytics snippet) is left alone as page HTML. Before, it could stop the component's atoms being labelled, receive the component-naming import (a `SyntaxError` when the page loads), or have its calls wrapped in the label helper (a `ReferenceError`).
- A comment in `<script module>` that mentions `<svelte:head>` no longer stops the instance script's atoms being labelled.
