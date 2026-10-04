<script lang="ts">
  import NoteEditor from "./note-editor.svelte";

  let kind = $state<"scoped" | "module">("scoped");
</script>

<div aria-label="Draft" class="flex flex-wrap gap-2" role="group">
  <button
    aria-pressed={kind === "scoped"}
    onclick={() => (kind = "scoped")}
  >
    Scoped atom
  </button>
  <button
    aria-pressed={kind === "module"}
    onclick={() => (kind = "module")}
  >
    Module atom
  </button>
</div>
<!-- Providers run once, so the editors start again on a new choice. -->
{#key kind}
  <div class="mt-3 grid gap-3 sm:grid-cols-2">
    <NoteEditor {kind} name="Note A" />
    <NoteEditor {kind} name="Note B" />
  </div>
{/key}
