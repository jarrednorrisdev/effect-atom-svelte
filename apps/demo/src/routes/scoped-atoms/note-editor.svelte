<script lang="ts">
  import type { Snippet } from "svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";
  import Preview from "./preview.svelte";
  import TextField from "./text-field.svelte";
  import Toolbar from "./toolbar.svelte";

  interface Props {
    /** Another editor inside this one, as a reply inside a post. */
    readonly children?: Snippet;
    readonly kind: "scoped" | "module";
    readonly name: string;
  }

  const { children, kind, name }: Props = $props();

  // Every component below finds this editor's draft with Draft.use(), no props.
  // svelte-ignore state_referenced_locally
  const draft = Draft.provide(kind);
</script>

<DraftPart atom={draft} {name} provides>
  <div aria-label={name} class="grid gap-2" role="group">
    <Toolbar />
    <TextField />
    <Preview />
    {@render children?.()}
  </div>
</DraftPart>
