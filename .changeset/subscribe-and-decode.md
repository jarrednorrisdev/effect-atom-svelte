---
"effect-atom-svelte": patch
---

`useAtomSubscribe` with a getter now subscribes again only when the getter returns a different atom. A getter that ran again and returned the same atom, as `() => profileAtom(user.id)` does for a new `user` with the same id, called `f` again with an unchanged value under `immediate`, and could drop a change still waiting to be delivered.

A seed the browser can't decode with the atom's schema, as after a deploy between the server render and hydration, is now dropped and the browser computes the atom, as for a result the server couldn't encode. It made `useAtomSuspense` and `useAtomResult` reject for good, with unhandled rejections. Development builds warn.
