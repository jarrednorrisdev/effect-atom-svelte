<script lang="ts">
  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";
  import NoteEditor from "./note-editor.svelte";

  let kind = $state<"own" | "shared">("own");

  // For comparison: one draft above both editors. An editor that doesn't
  // provide its own finds this one with Draft.use(), as both would find an
  // atom defined at module level.
  const shared = Draft.provide("");
</script>

<div aria-label="Draft" class="flex flex-wrap gap-2" role="group">
  <button aria-pressed={kind === "own"} onclick={() => (kind = "own")}>
    A draft per editor
  </button>
  <button aria-pressed={kind === "shared"} onclick={() => (kind = "shared")}>
    One draft for both
  </button>
</div>
<div class="mt-3">
  {#if kind === "own"}
    <div class="grid gap-3 sm:grid-cols-2">
      <NoteEditor name="Note A" />
      <NoteEditor name="Note B" />
    </div>
  {:else}
    <DraftPart atom={shared} name="Editors" provides>
      <div class="grid gap-3 sm:grid-cols-2">
        <NoteEditor name="Note A" provides={false} />
        <NoteEditor name="Note B" provides={false} />
      </div>
    </DraftPart>
  {/if}
</div>
