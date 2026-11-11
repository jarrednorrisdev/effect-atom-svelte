# Bug hunts

What `hunt-bugs` needs to know about this repo. Add to the areas what each loop teaches.

- **Setup**: a hunter's worktree needs `bun install`, then the packages built (`bunx turbo run build --filter='./packages/*'`). Hunters run Chromium and the server project only; CI runs the other engines.
- **Run one test**: `cd packages/effect-atom-svelte && bunx vitest run --project "browser (chromium)" --project server test/<file> -t "<name>"`. Write the test in the style of the existing ones (`test/`, `test/fixtures/`, `test/helpers.ts`). The `renderOnServer` browser command runs a server render for hydration tests.
- **Promises**: the behaviour the code promises lives in the JSDoc of `packages/effect-atom-svelte/src/`, the docs pages (`apps/demo/src/routes/**/+page.md`) and `packages/effect-atom-svelte/README.md`.
- **Compare with**: `@effect/atom-react`, Effect's React bindings for the same atoms. If it behaves the same way, the behaviour is probably intended.
- **Upstream**: Effect's reactivity module (`effect/unstable/reactivity`: `Atom`, `AtomRegistry`, `Hydration`), read in `packages/effect-atom-svelte/node_modules/effect/src/reactivity/`. A bug in Effect's own behaviour is upstream.
- **Never mutate in place**: none. A proof is a new test in an existing test file, in the hunter's own worktree.

## Areas

One hunter per area: the code, then the questions that found bugs before. Paths without a prefix are under `packages/effect-atom-svelte/`.

### Sync hooks

`src/Hooks.svelte.ts` up to the async section, `src/RegistryContext.ts`, `src/RegistryProvider.svelte`, `src/ScopedAtom.ts`, `src/SvelteKit.ts`, `src/internal/teardown.svelte.ts`.

- Holds and mounts: released exactly once, per holder, on destroy, on a getter switch, on destroy before mount, and when setup throws midway.
- Getter switches in every hook: the old atom released, the new one followed, nothing computed twice.
- Teardown order: a parent's registry outliving its children's teardown.
- Server: a caller-owned registry shared by concurrent requests.
- `useAtomSet`'s promise modes: overlapping calls, signals aborted before, during and after.

### Async, SSR and hydration

`src/Hooks.svelte.ts` from the async section on, `src/HydrationBoundary.svelte`, `src/internal/hydration.ts`, `src/internal/renderEnd.ts`.

- Hangs: a promise that never settles (an `Atom.fn` not started, a refresh to `Initial`, a destroy while seeding).
- Seeds: encoded or decoded wrongly, spent, shared between readers with different options, or left for a later request.
- What the server renders against what it sends.
- The browser against the server: run the server render with the `renderOnServer` command, then hydrate it.

### Inspector and devtools

`src/Inspector.ts`, `src/internal/nodeInternals.ts`, `src/internal/registries.ts`, `src/internal/scope.svelte.ts`, and `packages/effect-atom-svelte-devtools/src/`.

- Instrumentation must only observe: no change to the registry's behaviour.
- Event order and causes against the documented ones.
- The labels plugin's transform on real Svelte syntax: `generics`, `<svelte:head>`, comments, module scripts, every `.pipe(...)`.
- Hot reload keeping state.
- The panel's saved settings against its props.

### Packaging and compatibility

Build and pack both packages (`bun pm pack`), and install the tarballs into fresh projects outside the repo (a temp folder):

- SvelteKit 3;
- SvelteKit 2;
- plain Svelte and Vite with async mode off;
- a `tsc`-only consumer.

Check every `exports` subpath, the `.d.ts` files, the peer ranges, and that every docs and README snippet compiles.

### Test strength

Mutation testing: break `src` one meaningful way at a time, run the suites, and write a test for each break that survives and is observable. A mutation with no observable effect needs its reason recorded, not a test.
