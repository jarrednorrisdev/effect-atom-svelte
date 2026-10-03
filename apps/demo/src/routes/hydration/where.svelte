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

  // Before the await: see "Event handlers after an await" on the Suspense page.
  const refresh = useAtomRefresh(whereAtom);

  // The server waits for the first result and sends it with the page.
  const where = await useAtomResult(whereAtom);
</script>

{#if where.current._tag === "Success"}
  <p>
    Computed on <output data-testid="computed-on">{where.current.value}</output>
    {where.current.waiting ? "(computing again…)" : ""}
  </p>
{/if}
<button onclick={refresh}>Compute again</button>
