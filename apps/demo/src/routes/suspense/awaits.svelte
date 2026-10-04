<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import Timeline from "#lib/docs/kit/timeline.svelte";

  import Combined from "./combined.svelte";
  import OneByOne from "./one-by-one.svelte";
  import { combined, oneByOne, together } from "./slow-pairs.ts";
  import Together from "./together.svelte";

  let mounted = $state(false);

  const toggle = () => {
    if (!mounted) {
      for (const side of [oneByOne, together, combined]) {
        side.log.clear();
      }
    }
    mounted = !mounted;
  };

  const sides = [
    { component: OneByOne, label: "<OneByOne>: await, then await", log: oneByOne.log },
    { component: Together, label: "<Together>: Promise.all", log: together.log },
    { component: Combined, label: "<Combined>: Effect.all, one await", log: combined.log },
  ];
</script>

<p>
  <button data-cue={mounted ? "reset" : "start"} onclick={toggle}>
    {mounted ? "Unmount all three" : "Mount all three"}
  </button>
</p>
<div class="grid gap-3 lg:grid-cols-3">
  {#each sides as side (side.label)}
    <Part code dashed={!mounted} label={side.label} top>
      {#if mounted}
        <svelte:boundary>
          <side.component />
          {#snippet pending()}
            <ResultChip kind="message" tone="running">Awaiting…</ResultChip>
          {/snippet}
        </svelte:boundary>
      {:else}
        Not mounted.
      {/if}
      <!-- One lane per load: a dot when it starts and when it ends. -->
      <Timeline entries={side.log.entries} lanes={["todos", "user"]} span={2500} />
    </Part>
  {/each}
</div>
