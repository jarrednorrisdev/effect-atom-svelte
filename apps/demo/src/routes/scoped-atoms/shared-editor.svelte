<script lang="ts">
  import DraftPart from "./draft-part.svelte";
  import Preview from "./preview.svelte";
  import TextField from "./text-field.svelte";
  import Toolbar from "./toolbar.svelte";

  // The same parts as NoteEditor, with no provider: Draft.use() in each part
  // finds the draft provided above this editor.
  const { name }: { name: string } = $props();
</script>

<DraftPart {name}>
  <div aria-label={name} class="grid gap-2" role="group">
    <Toolbar />
    <TextField />
    <Preview />
  </div>
</DraftPart>
