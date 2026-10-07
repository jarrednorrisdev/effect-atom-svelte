<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  const log = new EventLogState({ limit: 6 });

  const reportAtom = Atom.make(
    Effect.gen(function* buildReport() {
      log.add("effect started", { tone: "running" });
      yield* Effect.sleep("3 seconds");
      log.add("effect finished", { tone: "success" });
      return "Your report is ready";
    }).pipe(
      // Runs if nothing reads the atom any more before the effect finishes.
      Effect.onInterrupt(() =>
        Effect.sync(() => log.add("effect interrupted", { tone: "interrupted" }))
      )
    )
  );
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const report = useAtomSuspense(reportAtom);
  let shown = $state(false);
</script>

<button aria-pressed={shown} onclick={() => (shown = !shown)}>Show the report</button>
<!-- The hook holds reportAtom only while this markup reads it. -->
{#if shown}
  <div class="mt-3">
    <svelte:boundary>
      <ResultChip data-testid="report" kind="message" tone="success">
        {await report.current}
      </ResultChip>
      {#snippet pending()}
        <ResultChip kind="message" tone="running">Loading…</ResultChip>
      {/snippet}
    </svelte:boundary>
  </div>
{/if}
<div class="mt-3">
  <EventLog
    code
    data-testid="report-log"
    empty="Show the report to start its effect."
    entries={log.entries}
    label="reportAtom's effect"
    max={4}
  />
</div>
