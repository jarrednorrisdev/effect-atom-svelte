<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";

  const draft = useAtomValue(Draft.use());
</script>

<Part code label="Preview: Draft.use()">
  {#if draft.current.trim() === ""}
    <span class="text-sm text-muted-foreground">Nothing written yet.</span>
  {:else}
    <p class="m-0 whitespace-pre-wrap">{draft.current}</p>
  {/if}
</Part>
