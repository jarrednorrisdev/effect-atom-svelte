<!--
  The two atoms of the revalidateOnHydrate example side by side: where each one's current result
  was computed, what the server's HTML had, and the states it has been through since it hydrated.
  Presentation only: revalidate.svelte holds the example's logic.
-->
<script lang="ts">
  import type { AsyncResult } from "effect/reactivity";
  import Origin from "#lib/docs/kit/origin.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import ServerHtml from "#lib/docs/kit/server-html.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";
  import type { Tone } from "#lib/docs/kit/tone.ts";

  type Where = AsyncResult.AsyncResult<string, never>;

  interface Props {
    readonly fresh: Where;
    readonly kept: Where;
  }

  const { fresh, kept }: Props = $props();

  const tone = (result: Where): Tone => (result.waiting ? "running" : toneOf(result));
  const where = (result: Where) => (result._tag === "Success" ? result.value : undefined);
</script>

<div class="parts not-prose">
  <Part code data-testid="revalidate-kept" label="default" tone={tone(kept)}>
    <p class="line">
      <Origin data-testid="revalidate-kept-where" where={where(kept)} />
      <ServerHtml data-testid="revalidate-kept-html" of="revalidate-kept-where" />
    </p>
    <ResultHistory data-testid="revalidate-kept-history" result={kept} />
  </Part>
  <Part
    code
    data-testid="revalidate-fresh"
    label="revalidateOnHydrate: true"
    tone={tone(fresh)}
  >
    <p class="line">
      <Origin data-testid="revalidate-fresh-where" where={where(fresh)} />
      <ServerHtml data-testid="revalidate-fresh-html" of="revalidate-fresh-where" />
    </p>
    <ResultHistory data-testid="revalidate-fresh-history" result={fresh} />
  </Part>
</div>

<style>
  .parts {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  }
  .line {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
  }
</style>
