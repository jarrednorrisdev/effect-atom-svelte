<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";

  const draft = useAtom(Draft.use());
  const words = $derived(draft.current.split(/\s+/u).filter(Boolean).length);
</script>

<DraftPart name="Toolbar">
  <div class="flex items-center justify-between gap-2">
    <span class="text-sm">{words} {words === 1 ? "word" : "words"}</span>
    <button class="mr-0!" onclick={() => (draft.current = "")}>Clear</button>
  </div>
</DraftPart>
