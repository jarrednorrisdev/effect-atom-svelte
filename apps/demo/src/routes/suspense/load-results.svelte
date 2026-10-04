<!--
  The awaits example's outcome for one component: how long it took to be ready, and each atom's
  result, labelled, as a state badge. Not part of the example's code.
-->
<script lang="ts">
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import type { AsyncResult } from "effect/reactivity";

  interface Props {
    /** Each result by the name the component reads it under. */
    readonly results: Readonly<Record<string, AsyncResult.AsyncResult<unknown, unknown>>>;
    /** How long the script waited, in seconds. */
    readonly seconds: string;
    readonly testid: string;
  }

  const { results, seconds, testid }: Props = $props();
</script>

<p class="ready">
  Ready after <output data-testid={testid}>{seconds} s</output>
</p>
<ul class="results">
  {#each Object.entries(results) as [name, result] (name)}
    <li>
      <code>{name}</code>
      <StateBadge data-testid="{testid}-{name}" {result} sound={false} />
    </li>
  {/each}
</ul>

<style>
  .ready {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }
  .results {
    display: grid;
    gap: 0.35rem;
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
  }
  li {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    margin: 0;
  }
  code {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
</style>
