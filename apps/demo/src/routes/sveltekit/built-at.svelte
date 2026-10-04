<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  const Stamp = Schema.Struct({ at: Schema.Number, where: Schema.String });

  // When and where it was computed.
  const stampAtom = Atom.make(
    Effect.sync(() => ({ at: Date.now(), where: browser ? "browser" : "server" }))
  ).pipe(
    Atom.serializable({
      key: "built-at",
      schema: AsyncResult.Schema({ success: Stamp }),
    })
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomResult } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  // The time, and how long ago it was, counted in the browser.
  import Age from "./age.svelte";

  const refresh = useAtomRefresh(stampAtom);

  // Prerendered: computed once, when the site was built.
  const stamp = await useAtomResult(stampAtom);
</script>

<p><button onclick={refresh}>Compute again</button></p>
{#if stamp.current._tag === "Success"}
  <p class="flex flex-wrap items-center gap-2">
    <Origin data-testid="stamp-where" where={stamp.current.value.where} />
    <Age at={stamp.current.value.at} />
  </p>
{/if}
