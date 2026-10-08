---
"effect-atom-svelte": patch
---

Fix several edge cases in server rendering and hydration:

- On the server, `useAtomResult` and `useAtomSuspense` render a value from `useAtomInitialValues` without running the atom, as `useAtomValue` already did, so a browser-only read or a request the value was there to save no longer runs on the server.
- With `suspendOnWaiting`, the result sent to the browser is the settled one the server rendered, not one still waiting, which the browser would run again.
- On the server, `HydrationBoundary` ignores a value dehydrated as a promise, so one that lands after the render can no longer reach a later request through a registry the caller passes in.
- Destroying a `HydrationBoundary` keeps the values another boundary given the same state queued, as a layout and its page might be.
- A seeded `useAtomSuspense` read in the script, outside any reaction, lets go of its atom once the getter moves on.
- A hook after a top-level `await` no longer warns in development about a missed seed for an atom whose result the server didn't send, such as a defect.
