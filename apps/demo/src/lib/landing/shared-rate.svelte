<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Parts from "#lib/docs/kit/parts.svelte";

  import { runs } from "./rate-log.ts";
  import Rate from "./rate.svelte";

  // Two places on a page that show the rate, each turned on and off here.
  const shown = $state({ checkout: false, header: false });
  const names = ["header", "checkout"] as const;
</script>

<Parts>
  {#each names as name (name)}
    <Part dashed={!shown[name]} label={name} tone={shown[name] ? "success" : "idle"}>
      {#if shown[name]}
        <Rate {name} />
      {:else}
        <p class="m-0 text-muted-foreground">Not shown</p>
      {/if}
      {#snippet actions()}
        <button aria-pressed={shown[name]} onclick={() => (shown[name] = !shown[name])}>
          Show the {name}
        </button>
      {/snippet}
    </Part>
  {/each}
</Parts>
<div class="mt-3">
  <EventLog
    code
    data-testid="rate-log"
    empty="Show the header or checkout to start the effect."
    entries={runs.entries}
    label="rateAtom's effect"
    max={4}
  />
</div>
