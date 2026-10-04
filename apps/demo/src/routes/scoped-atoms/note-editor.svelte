<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import type { Snippet } from "svelte";

  import { Draft } from "./draft-scope.ts";
  import Preview from "./preview.svelte";
  import { nameProvider } from "./providers.ts";
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
  // svelte-ignore state_referenced_locally
  nameProvider(draft, name);
</script>

<Part code label="{name}: Draft.provide()">
  <div aria-label={name} class="grid gap-2" role="group">
    <Toolbar />
    <TextField />
    <Preview />
    {@render children?.()}
  </div>
</Part>
