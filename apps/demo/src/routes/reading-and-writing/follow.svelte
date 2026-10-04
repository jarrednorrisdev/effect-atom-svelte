<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const draftAtom = Atom.make("Half a thought");
  const savedAtom = Atom.make("Published post");
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  let showSaved = $state(false);

  // A getter: the hook follows whichever atom the function returns.
  const text = useAtom(() => (showSaved ? savedAtom : draftAtom));

  const draft = useAtomValue(draftAtom);
  const saved = useAtomValue(savedAtom);
</script>

<p>
  <label class="whitespace-nowrap">
    <input bind:checked={showSaved} type="checkbox" /> Follow savedAtom
  </label>
  <input
    aria-label="Followed text"
    bind:value={text.current}
    data-testid="followed"
  />
</p>
<div class="flex flex-wrap gap-3">
  <Part code label="draftAtom" tone={showSaved ? "idle" : "success"}>
    <FlashValue data-testid="draft" value={draft.current} />
    {#if !showSaved}<small>followed</small>{/if}
  </Part>
  <Part code label="savedAtom" tone={showSaved ? "success" : "idle"}>
    <FlashValue data-testid="saved" value={saved.current} />
    {#if showSaved}<small>followed</small>{/if}
  </Part>
</div>
