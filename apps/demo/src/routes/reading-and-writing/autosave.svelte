<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const noteAtom = Atom.make("");
</script>

<script lang="ts">
  import { useAtom, useAtomSubscribe } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  const note = useAtom(noteAtom);
  const saves = new EventLogState();

  // Runs on every change, and once now because of immediate.
  useAtomSubscribe(noteAtom, (text) => saves.add(`saved "${text}"`), {
    immediate: true,
  });
</script>

<p>
  <input aria-label="Note" bind:value={note.current} data-testid="note" />
  <button onclick={() => (note.current = "")}>Clear</button>
</p>
<EventLog entries={saves.entries} label="Saves" />
