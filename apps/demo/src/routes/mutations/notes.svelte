<script module lang="ts">
  import { Effect, Layer } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  // Stands in for a server: a list that takes a moment to read, and a second to change.
  const saved = ["Read the docs"];

  const loadNotes = Effect.sync(() => [...saved]).pipe(Effect.delay("300 millis"));

  const notesAtom = Atom.make(loadNotes).pipe(
    // Read the list again whenever a mutation invalidates the "notes" key.
    Atom.withReactivity(["notes"])
  );

  const runtime = Atom.runtime(Layer.empty);

  // Invalidates "notes" when it finishes.
  const addAtom = runtime.fn(
    (note: string) =>
      Effect.sync(() => {
        saved.push(note);
      }).pipe(Effect.delay("1 second")),
    { reactivityKeys: ["notes"] }
  );

  // Shows a provisional list while addAtom runs, then the real one once it is read
  // again.
  const optimisticNotesAtom = Atom.optimistic(notesAtom);
  const addOptimisticAtom = optimisticNotesAtom.pipe(
    Atom.optimisticFn({
      fn: addAtom,
      reducer: (current, note: string) =>
        current.pipe(AsyncResult.map((notes) => [...notes, `${note} (saving…)`])),
    })
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const notes = useAtomValue(optimisticNotesAtom);
  const adding = useAtomValue(addAtom);
  const add = useAtomSet(addAtom);
  const addOptimistic = useAtomSet(addOptimisticAtom);

  let draft = $state("Write a note");
</script>

<p>
  <input bind:value={draft} data-testid="note" />
  <button disabled={adding.current.waiting} onclick={() => add(draft)}>Add</button>
  <button onclick={() => addOptimistic(draft)}>Add optimistically</button>
</p>
{#if notes.current._tag === "Success"}
  <ul data-testid="notes" style:opacity={notes.current.waiting ? 0.5 : 1}>
    {#each notes.current.value as note, index (index)}<li>{note}</li>{/each}
  </ul>
{:else}
  <p>Loading…</p>
{/if}
