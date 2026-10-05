<script lang="ts">
  import type { AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  // What the server's HTML had in the same place.
  import ServerHtml from "#lib/docs/kit/server-html.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";

  import { pricesAtom, pricesWithKeysAtom } from "./prices.ts";

  // Plain reads: the values come from the HydrationBoundary around this component.
  const prices = useAtomValue(pricesAtom);
  const withKeys = useAtomValue(pricesWithKeysAtom);
</script>

{#snippet price(name: string, result: AsyncResult.AsyncResult<string, never>)}
  <Part code data-testid={name} label={name} tone={toneOf(result)}>
    <p class="m-0 flex flex-wrap items-center gap-2">
      <Origin
        data-testid="{name}-where"
        where={result._tag === "Success" ? result.value : undefined}
      />
      <StateBadge {result} />
    </p>
    <p class="mt-2 mb-0"><ServerHtml of="{name}-where" /></p>
  </Part>
{/snippet}

<div class="grid gap-3 sm:grid-cols-2">
  {@render price("pricesAtom", prices.current)}
  {@render price("pricesWithKeysAtom", withKeys.current)}
</div>
