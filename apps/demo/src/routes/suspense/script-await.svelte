<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import Notes, { script } from "./notes.svelte";
  import ScriptSteps from "./script-steps.svelte";

  let mounted = $state(false);

  const toggle = () => {
    if (!mounted) {
      script.clear();
    }
    mounted = !mounted;
  };
</script>

<p>
  <button
    aria-pressed={mounted}
    data-cue={mounted ? "reset" : "start"}
    onclick={toggle}
  >
    Mount the component
  </button>
</p>
<Part
  code
  dashed={!mounted}
  label="<Notes>"
  tone={mounted ? "success" : "idle"}
>
  {#if mounted}
    <!-- The boundary shows its pending snippet while the script waits. -->
    <svelte:boundary>
      <Notes />
      {#snippet pending()}
        <ResultChip kind="message" tone="running">
          <span data-testid="notes-pending">
            Pending: the script is waiting
          </span>
        </ResultChip>
      {/snippet}
    </svelte:boundary>
  {:else}
    <p>Not mounted.</p>
  {/if}
</Part>
<ScriptSteps entries={script.entries} />
