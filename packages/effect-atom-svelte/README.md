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
