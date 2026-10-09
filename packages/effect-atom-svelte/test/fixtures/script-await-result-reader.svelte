<!-- As in the demo's Waits example: useAtomResult awaited in the script, its result shown in an
     {#if}, and a pending boundary around a component that suspends. -->
<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  const whereAtom = (key: string) =>
    Atom.make(
      Effect.sync((): string => (typeof window === "undefined" ? "server" : "browser")).pipe(
        Effect.delay("20 millis")
      )
    ).pipe(
      Atom.serializable({ key, schema: AsyncResult.Schema({ success: Schema.String }) })
    );

  const scriptAtom = whereAtom("script-await-result-script");
  const laterAtom = whereAtom("script-await-result-later");
</script>

<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import Later from "./script-await-result-later.svelte";

  const script = await useAtomResult(scriptAtom);
</script>

{#if script.current._tag === "Success"}
  <output>{script.current.value}</output>
{/if}
<svelte:boundary>
  <Later atom={laterAtom} />
  {#snippet pending()}
    <span>pending</span>
  {/snippet}
</svelte:boundary>
