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

  let followed = $state<"draft" | "saved">("draft");

  // A getter: the hook follows whichever atom the function returns.
  const text = useAtom(() => (followed === "saved" ? savedAtom : draftAtom));

  const draft = useAtomValue(draftAtom);
  const saved = useAtomValue(savedAtom);
</script>

<div aria-label="Follow" class="flex flex-wrap gap-2" role="group">
  <button aria-pressed={followed === "draft"} onclick={() => (followed = "draft")}>
    draftAtom
  </button>
  <button aria-pressed={followed === "saved"} onclick={() => (followed = "saved")}>
    savedAtom
  </button>
</div>
<div class="mt-3 flex flex-col gap-3 sm:flex-row">
  <Part code label="text = useAtom(getter)">
    <input
      aria-label="Followed text"
      bind:value={text.current}
      class="w-44"
      data-testid="followed"
    />
  </Part>
  <!-- The arrow points at the atom the getter returns. -->
  <div class="grid flex-1 grid-cols-[4.5rem_1fr] gap-3">
    <span class="flex justify-center">
      {#if followed === "draft"}
        <Arrow both label="get, set" pulse={text.current} />
      {/if}
    </span>
    <Part code label="draftAtom" tone={followed === "draft" ? "success" : "idle"}>
      <FlashValue data-testid="draft" value={draft.current} />
    </Part>
    <span class="flex justify-center">
      {#if followed === "saved"}
        <Arrow both label="get, set" pulse={text.current} />
      {/if}
    </span>
    <Part code label="savedAtom" tone={followed === "saved" ? "success" : "idle"}>
      <FlashValue data-testid="saved" value={saved.current} />
    </Part>
  </div>
</div>
