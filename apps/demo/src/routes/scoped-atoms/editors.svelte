<script lang="ts">
  import NoteEditor from "./note-editor.svelte";

  let shared = $state(false);
</script>

<p>
  <button aria-pressed={shared} onclick={() => (shared = !shared)}>
    Use one module atom instead
  </button>
</p>
<!-- Providers run once, so the editors start again when the switch changes. -->
{#key shared}
  <div class="grid gap-3 sm:grid-cols-2">
    <NoteEditor name="Note A" {shared} />
    <NoteEditor name="Note B" {shared} />
  </div>
{/key}
