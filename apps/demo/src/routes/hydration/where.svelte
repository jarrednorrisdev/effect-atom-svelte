<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // Records where it was computed. The schema encodes its result for the trip to
  // the browser.
  const whereAtom = Atom.make(
    Effect.sync((): string => (browser ? "the browser" : "the server")).pipe(
      Effect.delay("300 millis")
    )
  ).pipe(
    Atom.serializable({
      key: "where",
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomResult } from "effect-atom-svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  // The two boxes in the result: the server render and the browser.
  import WhereParts from "./where-parts.svelte";

  // Before the await: see "Handlers after an await" on the Troubleshooting page.
  const refresh = useAtomRefresh(whereAtom);

  // The server waits for the first result and sends it with the page.
  const where = await useAtomResult(whereAtom);
</script>

<p class="flex flex-wrap items-center gap-3">
  <button onclick={refresh}>Compute again</button>
  <StateBadge data-testid="where-state" result={where.current} />
</p>
{#if where.current._tag === "Success"}
  <WhereParts computedOn={where.current.value} waiting={where.current.waiting} />
{/if}
<ResultHistory data-testid="where-history" result={where.current} />
