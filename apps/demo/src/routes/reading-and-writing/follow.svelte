<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const draftAtom = Atom.make("Half a thought");
  const savedAtom = Atom.make("Published post");
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Parts from "#lib/docs/kit/parts.svelte";

  let followed = $state<"draft" | "saved">("draft");

  // A getter: the hook follows whichever atom the function returns.
  const text = useAtom(() => (followed === "saved" ? savedAtom : draftAtom));

  // These read both atoms all the time, so each keeps its text while the hook follows the other.
  const draft = useAtomValue(draftAtom);
  const saved = useAtomValue(savedAtom);
</script>

<div aria-label="Follow" class="flex flex-wrap gap-2" role="group">
  <button
    aria-pressed={followed === "draft"}
    onclick={() => (followed = "draft")}
  >
    draftAtom
  </button>
  <button
    aria-pressed={followed === "saved"}
    onclick={() => (followed = "saved")}
  >
    savedAtom
  </button>
</div>
<Parts class="mt-3" fan>
  <Part code label="text = useAtom(getter)">
    <input
      aria-label="Followed text"
      bind:value={text.current}
      class="w-44"
      data-testid="followed"
    />
  </Part>
  <!-- The arrow points at the atom the getter returns. -->
  <span>
    {#if followed === "draft"}
      <Arrow both label="get, set" pulse={text.current} />
    {/if}
  </span>
  <Part code label="draftAtom" tone={followed === "draft" ? "success" : "idle"}>
    <FlashValue data-testid="draft" value={draft.current} />
  </Part>
  <span>
    {#if followed === "saved"}
      <Arrow both label="get, set" pulse={text.current} />
    {/if}
  </span>
  <Part code label="savedAtom" tone={followed === "saved" ? "success" : "idle"}>
    <FlashValue data-testid="saved" value={saved.current} />
  </Part>
</Parts>
