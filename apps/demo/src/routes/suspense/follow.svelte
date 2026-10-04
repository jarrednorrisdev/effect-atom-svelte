<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // What each note's effect did, for the log under the example. Its entries show
  // at once, not held back with the update that waits for a note.
  const log = new EventLogState({ separate: true });

  const loadNote = (id: number) =>
    Effect.gen(function* load() {
      log.add(`note ${id} started`, { tone: "running" });
      yield* Effect.sleep("700 millis");
      log.add(`note ${id} loaded`, { tone: "success" });
      return `Note ${id}`;
    }).pipe(
      Effect.onInterrupt(() =>
        Effect.sync(() => log.add(`note ${id} interrupted`, { tone: "interrupted" }))
      )
    );

  // One atom per note. withServerValueInitial keeps them off the server, so the
  // browser loads the first note and the log shows it.
  const noteAtom = Atom.family((id: number) =>
    Atom.make(loadNote(id)).pipe(Atom.withServerValueInitial)
  );
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  let id = $state(1);
  // Follows whichever atom the getter returns.
  const note = useAtomSuspense(() => noteAtom(id));
</script>

<div aria-label="Note" class="flex flex-wrap gap-2" role="group">
  {#each [1, 2, 3] as noteId (noteId)}
    <button aria-pressed={id === noteId} onclick={() => (id = noteId)}>
      Note {noteId}
    </button>
  {/each}
</div>
<svelte:boundary>
  <div class="mt-3 flex flex-wrap items-center gap-3">
    <ResultChip busy={$effect.pending() > 0} kind="message" tone="success">
      <span data-testid="follow-note">{await note.current}</span>
    </ResultChip>
    <span class="text-xs">
      $effect.pending():
      <output data-testid="follow-pending">{$effect.pending()}</output>
    </span>
  </div>
  {#snippet pending()}
    <p class="mt-3">
      <ResultChip kind="message" tone="running">Loading…</ResultChip>
    </p>
  {/snippet}
</svelte:boundary>
<EventLog entries={log.entries} label="Note effects" max={8} />
