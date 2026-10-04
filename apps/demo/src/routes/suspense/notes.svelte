<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // What the component's script did, for the log beside the example.
  export const script = new EventLogState();

  // Takes 800 ms, and says how many times it has loaded.
  let loads = 0;
  const notesAtom = Atom.make(
    Effect.sync(() => (loads += 1)).pipe(Effect.delay("800 millis"))
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomResult } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // A hook whose function a button calls goes before the await.
  const refresh = useAtomRefresh(notesAtom);

  script.add("script started", { tone: "running" });
  const notes = await useAtomResult(notesAtom);
  // Runs once, when the atom has its first result.
  script.add("script continued after the await", { tone: "success" });
</script>

<p class="flex flex-wrap items-center gap-3">
  {#if notes.current._tag === "Success"}
    <ResultChip busy={notes.current.waiting} kind="message" tone="success">
      <span data-testid="notes">
        Loaded {notes.current.value} time{notes.current.value === 1 ? "" : "s"}
      </span>
    </ResultChip>
  {/if}
  <StateBadge data-testid="notes-state" result={notes.current} />
  <button aria-label="Refresh notes" onclick={refresh}>Refresh</button>
</p>
