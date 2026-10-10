# Proposal: `useAtomSuspense` waits for a refresh of a failed atom

Status: draft, for the maintainer to decide. Changes default behaviour, so not implemented. Written against `effect` 4.0.1.

## Summary

Treat a `Failure` that is `waiting` (a failed atom being refreshed) as pending in `useAtomSuspense`, whatever `suspendOnWaiting` says, unless `includeFailure` is set. Retrying from a boundary's `failed` snippet then needs only `refresh(); reset();`, without `suspendOnWaiting: true`.

## Problem

`useAtomSuspense` decides whether to wait with `isPending` (`packages/effect-atom-svelte/src/Hooks.svelte.ts`): a result is pending when it is `Initial`, or `waiting` with `suspendOnWaiting`. Otherwise `fromSettled` resolves a `Success` with its value and rejects a `Failure` with `Cause.squash(cause)`.

A refreshing `Success` resolving straight away is the point of the default: the old value stays on screen while the new one loads. A refreshing `Failure` has no value to show, so resolving straight away means rejecting with the failure the user is retrying. In a boundary, that is the documented trap:

```svelte
<script lang="ts">
  const todo = useAtomSuspense(todoAtom);
  const refresh = useAtomRefresh(todoAtom);
</script>

{#snippet failed(error, reset)}
  <button onclick={() => { refresh(); reset(); }}>Try again</button>
{/snippet}
```

`reset()` renders the content again; it reads `todo.current`, which rejects at once with the old failure, so the `failed` snippet comes straight back. When the refresh succeeds, the boundary is showing `failed` and nothing renders the content again. The click looks like it did nothing.

The docs teach the workaround in three places (`suspense` "When it fails", `errors` "In a boundary", the `retry.svelte` example): read the atom with `suspendOnWaiting: true`. That has its own cost, which the Suspense page also explains: every later refresh of a successful value now suspends too, and because Svelte shows an update only once all of its awaits resolve, it holds back the atom's other reads.

`@effect/atom-react` behaves the same (`atomResultOrSuspend` in `packages/atom/react/src/Hooks.ts`), so this is inherited, not a Svelte-specific choice.

## Proposed behaviour

```ts
const isPending = (current, options) =>
  current._tag === "Initial" ||
  (current.waiting &&
    (options.suspendOnWaiting === true ||
      (current._tag === "Failure" && options.includeFailure !== true)));
```

| Result | Today | Proposed |
| --- | --- | --- |
| `Initial` | waits | waits |
| `Success`, waiting | resolves with the old value (waits with `suspendOnWaiting`) | unchanged |
| `Failure`, waiting | rejects with the old failure (waits with `suspendOnWaiting`) | **waits** for the refresh |
| `Failure`, waiting, `includeFailure` | resolves with the `Failure` (waits with `suspendOnWaiting`) | unchanged: the component shows the failure in place, with `waiting` to say a retry is running |

The retry above then works as written. `suspendOnWaiting` goes back to meaning one thing: keep old and new data from appearing together.

## Migration

- Code that already passes `suspendOnWaiting: true` for retries behaves the same.
- Code without it changes in one case: while a failed atom refreshes, its `await` is pending instead of rejecting again. In a boundary that has already shown `failed`, nothing renders the content until `reset()`, so nothing visible changes. In a boundary still showing content (the atom failed and was refreshed without the boundary failing, which needs the failure to be caught elsewhere), `$effect.pending()` now counts the wait.
- The docs drop the `suspendOnWaiting` step from the retry recipes, and the Suspense page's "Refreshing, and suspendOnWaiting" section loses its failure bullet.

## Risks

- It diverges from `@effect/atom-react`. The migration page would need a line.
- A failed atom whose refresh never settles keeps the `await` pending for good, where today it rejects. That is the same as a first load that never settles, and as `suspendOnWaiting: true` today.
- On the server, a refreshing failure would wait for the refresh. A server render only sees one if something refreshes during the render, which nothing in the library does.

## Recommendation

Do it, as a minor release with a changeset that calls out the change. Confidence: fairly high that it removes a real trap; my doubt is only the divergence from React, which the library already accepts elsewhere (`revalidateOnHydrate`, getters).
