<!-- Opens and closes the rename form, as a dialog would. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";

  import FormRename from "./form-rename.svelte";

  interface Props {
    readonly save: Atom.Writable<
      AsyncResult.AsyncResult<string, never>,
      { title: string }
    >;
  }

  const { save }: Props = $props();
  let open = $state(true);
  let title = $state("Feed the cat");
</script>

<button onclick={() => (open = !open)}>{open ? "Close" : "Open"}</button>
<button onclick={() => (title = "Walk the dog")}>Refetch</button>
{#if open}
  <FormRename {save} {title} />
{/if}
