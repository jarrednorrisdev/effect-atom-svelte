---
"effect-atom-svelte": patch
---

Server-rendered async atoms are no longer fetched again straight after hydration. Before, a query with `reactivityKeys` (or wrapped by `swr`, `debounce`, `withRefresh` or `makeRefreshOnSignal`) fetched its data again in the browser milliseconds after the server did; mutations on its keys still refresh it. Set `revalidateOnHydrate` on `RegistryProvider` or on `useAtomResult` / `useAtomSuspense` to fetch again once hydration is done, as `@effect/atom-react` does (JND-19).
