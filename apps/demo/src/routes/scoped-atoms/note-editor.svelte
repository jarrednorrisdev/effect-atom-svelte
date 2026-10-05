<script lang="ts">
  import { useAtomMount } from "effect-atom-svelte";
  import type { Snippet } from "svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";
  import Preview from "./preview.svelte";
  import TextField from "./text-field.svelte";
  import Toolbar from "./toolbar.svelte";

  interface Props {
    /** Another editor inside this one, as a reply inside a post. */
    readonly children?: Snippet;
    readonly initial?: string;
    readonly name: string;
    /** Provide a draft of its own, rather than use one from above. */
    readonly provides?: boolean;
  }

  const { children, initial = "", name, provides = true }: Props = $props();

  // Every component below finds this editor's draft with Draft.use(), no props.
  // A provider runs once, so `initial` is read once, when the editor is created.
  // svelte-ignore state_referenced_locally
  const draft = provides ? Draft.provide(initial) : Draft.use();
  // Held while the editor lives, even if no part below reads it.
  useAtomMount(draft);
</script>

<DraftPart atom={draft} {name} {provides}>
  <div aria-label={name} class="grid gap-2" role="group">
    <Toolbar />
    <TextField />
    <Preview />
    {@render children?.()}
  </div>
</DraftPart>
