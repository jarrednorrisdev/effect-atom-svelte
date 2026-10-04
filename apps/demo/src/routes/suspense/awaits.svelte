<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import OneByOne from "./one-by-one.svelte";
  import Together from "./together.svelte";

  let mounted = $state(false);
</script>

<p>
  <button
    data-cue={mounted ? "reset" : "start"}
    onclick={() => (mounted = !mounted)}
  >
    {mounted ? "Unmount both" : "Mount both"}
  </button>
</p>
<div class="grid gap-3 sm:grid-cols-2">
  <Part code dashed={!mounted} label="<OneByOne>">
    {#if mounted}
      <svelte:boundary>
        <OneByOne />
        {#snippet pending()}
          <ResultChip kind="message" tone="running">
            Awaiting one by one…
          </ResultChip>
        {/snippet}
      </svelte:boundary>
    {:else}
      Not mounted.
    {/if}
  </Part>
  <Part code dashed={!mounted} label="<Together>">
    {#if mounted}
      <svelte:boundary>
        <Together />
        {#snippet pending()}
          <ResultChip kind="message" tone="running">
            Awaiting both…
          </ResultChip>
        {/snippet}
      </svelte:boundary>
    {:else}
      Not mounted.
    {/if}
  </Part>
</div>
