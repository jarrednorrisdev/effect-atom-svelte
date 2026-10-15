# Areas

One hunting agent per area. Each line names the code and the questions that found bugs before; add what a loop teaches.

## Sync hooks

`src/Hooks.svelte.ts` up to the async section, `RegistryContext.ts`, `RegistryProvider.svelte`, `ScopedAtom.ts`, `SvelteKit.ts`, `internal/teardown.svelte.ts`.

- Holds and mounts: released exactly once, per holder, on destroy, on a getter switch, on destroy before mount, and when setup throws midway.
- Getter switches in every hook: the old atom released, the new one followed, nothing computed twice.
- Teardown order: a parent's registry outliving its children's teardown.
- Server: a caller-owned registry shared by concurrent requests.
- `useAtomSet`'s promise modes: overlapping calls, signals aborted before, during and after.

## Async, SSR and hydration

`src/Hooks.svelte.ts` from the async section on, `HydrationBoundary.svelte`, `internal/hydration.ts`, `internal/renderEnd.ts`.

- Hangs: a promise that never settles (an `Atom.fn` not started, a refresh to `Initial`, a destroy while seeding).
- Seeds: encoded or decoded wrongly, spent, shared between readers with different options, or left for a later request.
- What the server renders against what it sends.
- The browser against the server: run the server render with the `renderOnServer` command, then hydrate it.

## Inspector and devtools

`src/Inspector.ts`, `internal/nodeInternals.ts`, `internal/registries.ts`, `internal/scope.svelte.ts`, and `packages/effect-atom-svelte-devtools/src/`.

- Instrumentation must only observe: no change to the registry's behaviour.
- Event order and causes against the documented ones.
- The labels plugin's transform on real Svelte syntax: `generics`, `<svelte:head>`, comments, module scripts, every `.pipe(...)`.
- Hot reload keeping state.
- The panel's saved settings against its props.

## Packaging and compatibility

Build and pack both packages (`bun pm pack`), and install the tarballs into fresh projects under `/tmp`:

- SvelteKit 3;
- SvelteKit 2;
- plain Svelte and Vite with async mode off;
- a `tsc`-only consumer.

Check every `exports` subpath, the `.d.ts` files, the peer ranges, and that every docs and README snippet compiles.

## Test strength

Mutation testing: break `src` one meaningful way at a time, run the suites, and write a test for each break that survives and is observable. A mutation with no observable effect needs its reason recorded, not a test.

## Review (from the second loop on)

Merge every open fix branch into one worktree. For each fix, look for:

- what it breaks;
- the case it claims to fix but doesn't;
- what it changes for code that relied on the old behaviour.
