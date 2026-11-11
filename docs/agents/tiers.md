# High-risk areas

A ticket touching any of these goes on Opus, whatever its size (`wayfinder`'s `tiers.md`). Name each by path glob and say why it's risky.

- `packages/effect-atom-svelte/src/{Hooks.svelte.ts,RegistryContext.ts,RegistryProvider.svelte,ScopedAtom.ts}`, `packages/effect-atom-svelte/src/internal/{teardown.svelte.ts,disposal.ts,scope.svelte.ts}`: each hook holds and releases atoms against Svelte's lifecycle. A double release, a missed one or a wrong order leaks or breaks state without an error, and shows differently in each browser engine.
- `packages/effect-atom-svelte/src/{HydrationBoundary.svelte,SvelteKit.ts}`, `packages/effect-atom-svelte/src/internal/{hydration.ts,renderEnd.ts}`: what the server renders against what the browser hydrates. A mismatch or a hang appears only in a real SSR run.
- `packages/*/package.json`, `packages/*/svelte.config.js`: the published `exports`, peer ranges and build. A wrong subpath breaks every consumer, and only a packed install shows it.
- `.github/workflows/**`, `.github/scripts/**`: CI's gate (`ci-ok`), the skip-when-already-tested logic, the release workflow that publishes to npm, and the Cloudflare deploy.
- `apps/demo/alchemy.run.ts`: the deploy of the docs site.

## Review on Opus

A PR touching any of these is reviewed on Opus, whatever its ticket's tier (`review-pr`). Usually a few of the areas above, where a missed bug is costly; empty is fine.

- `packages/effect-atom-svelte/src/{Hooks.svelte.ts,RegistryContext.ts,RegistryProvider.svelte,ScopedAtom.ts}`, `packages/effect-atom-svelte/src/internal/teardown.svelte.ts`: release bugs show only under a particular order of events.
- `packages/effect-atom-svelte/src/{HydrationBoundary.svelte,SvelteKit.ts}`, `packages/effect-atom-svelte/src/internal/hydration.ts`: a hydration bug reaches every SSR user.
- `.github/workflows/release.yml`, `packages/*/package.json`: they decide what is published to npm.
