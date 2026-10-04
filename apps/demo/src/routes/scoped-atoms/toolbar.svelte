<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";

  const draft = useAtom(Draft.use());
  const words = $derived(draft.current.split(/\s+/u).filter(Boolean).length);
</script>

<Part code label="Toolbar: Draft.use()">
  <span class="text-sm">{words} {words === 1 ? "word" : "words"}</span>
  <button onclick={() => (draft.current = "")}>Clear</button>
</Part>
