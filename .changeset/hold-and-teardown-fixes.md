---
"effect-atom-svelte": patch
---

Fix atoms given a value by `useAtomInitialValues` being dropped while another component still held them: when one of two components seeding the same atom unmounted, the atom lost its value, and on the server a request sharing the registry could run the atom's browser-only read. On the server, requests rendering at the same time on a shared registry now keep the value the first one applied until the last of them ends.

`provideRegistry` now disposes of the registry it created when its component is destroyed while its script is still awaiting. A reader whose getter switched to an atom that threw while subscribing now follows that atom once it recovers. `handleClientError` uses SvelteKit 2's message for an error whose own message is empty, such as a `Data.TaggedError`.
