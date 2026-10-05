# `effect-atom-svelte`

Svelte 5 bindings for the Effect Atom modules (`effect/reactivity`), in the shape of `@effect/atom-react` and `@effect/atom-vue`.

This is a community project by Jarred Norris. It is not part of Effect, and the Effect team neither makes nor endorses it.

**Status:** pre-release, not published yet. It targets `effect` 4.0, Svelte 5.57+ with `experimental.async`, and SvelteKit 3. The `effect` peer range is `~4.0.0`, not `^4.0.0`: the bindings reach into parts of the atom registry that aren't public API, which a minor release of `effect` can change.

## Installation

Once it is published:

```sh
npm install "effect@~4.0.0" effect-atom-svelte
```

## Documentation

- **Guide and API reference**: [atom.jarrednorris.dev](https://atom.jarrednorris.dev).

## API decisions

These were settled before 0.1.0 ([JND-25](https://linear.app/jarrednorrisdev/issue/JND-25)).

- **Hooks return `{ current }`.** A Svelte function can't return a value that stays reactive, so the hooks return an object whose `current` is read (and, for `useAtom`, assigned). Svelte's own `fromStore`, `MediaQuery` and `createSubscriber` work the same way, and it's what lets `bind:value={name.current}` work. Destructuring `current` reads it once and loses reactivity.
- **Two async hooks.** `await useAtomResult(atom)` gives a live `AsyncResult`, for refresh indicators and failures as values. `useAtomSuspense(atom)` gives a promise to `await` in markup, with a boundary handling loading and errors. It resolves to the value rather than React's `Success` result, or to the `Success` or `Failure` with `includeFailure: true`.
- **React's names.** The hooks keep `@effect/atom-react`'s names, so code and knowledge move between the two. `useAtom` returns `{ current }` rather than a `[value, set]` tuple, and has no `mode` option: use `useAtomSet` for promise modes and updater functions.
- **Getters.** Every hook that reads an atom also takes a getter, `() => atom`, and follows it when it changes. `useAtomRefProp` is the exception: it returns `ref.prop(prop)`, a ref rather than a reactive value, so there is nothing to follow.
- **Transforms are cached.** `useAtomValue(atom, f)` runs `f` again only when the atom or state `f` reads changes, so a transform that builds an object returns the same object until then.
- **Abort signals.** A promise-mode setter's `signal` stops the wait, not the write. A signal that is already aborted settles the call as interrupted without writing, as `fetch` does.
