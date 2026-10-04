<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";
  import Preview from "./preview.svelte";
  import TextArea from "./text-area.svelte";
  import Toolbar from "./toolbar.svelte";

  const { name, shared }: { name: string; shared: boolean } = $props();

  // Every component below finds this editor's draft with Draft.use(), no props.
  // svelte-ignore state_referenced_locally
  Draft.provide(shared);
</script>

<Part code label="{name}: Draft.provide()">
  <div class="grid gap-2">
    <Toolbar />
    <label>
      <span class="sr-only">{name}</span>
      <TextArea />
    </label>
    <Preview />
  </div>
</Part>
