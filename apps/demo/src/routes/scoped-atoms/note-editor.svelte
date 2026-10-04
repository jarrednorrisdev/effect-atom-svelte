<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";
  import Preview from "./preview.svelte";
  import TextField from "./text-field.svelte";
  import Toolbar from "./toolbar.svelte";

  const { kind, name }: { kind: "scoped" | "module"; name: string } = $props();

  // Every component below finds this editor's draft with Draft.use(), no props.
  // svelte-ignore state_referenced_locally
  Draft.provide(kind);
</script>

<Part code label="{name}: Draft.provide()">
  <div aria-label={name} class="grid gap-2" role="group">
    <Toolbar />
    <TextField />
    <Preview />
  </div>
</Part>
