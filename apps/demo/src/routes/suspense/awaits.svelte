<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import Timeline from "#lib/docs/kit/timeline.svelte";

  import Combined from "./combined.svelte";
  import OneByOne from "./one-by-one.svelte";
  import { combined, oneByOne, setTodosFail, together } from "./slow-pairs.ts";
  import Together from "./together.svelte";

  let mounted = $state(false);
  let todosFail = $state(false);

  const toggle = () => {
    if (!mounted) {
      for (const side of [oneByOne, together, combined]) {
        side.log.clear();
      }
    }
    mounted = !mounted;
  };
  // Takes effect from the next mount, so unmount first.
  const toggleFail = () => {
    todosFail = !todosFail;
    setTodosFail(todosFail);
    mounted = false;
  };

  const sides = [
    {
      component: OneByOne,
      label: "<OneByOne>: await, then await",
      log: oneByOne.log,
    },
    {
      component: Together,
      label: "<Together>: Promise.all",
      log: together.log,
    },
    {
      component: Combined,
      label: "<Combined>: Effect.all, one await",
      log: combined.log,
    },
  ];
</script>

<p>
  <button
    aria-pressed={mounted}
    data-cue={mounted ? "reset" : "start"}
    onclick={toggle}
  >
    Mount all three
  </button>
  <button aria-pressed={todosFail} onclick={toggleFail}>Todos fails</button>
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
      <Timeline
        entries={side.log.entries}
        lanes={["todos", "user"]}
        span={3500}
      />
    </Part>
  {/each}
</div>
