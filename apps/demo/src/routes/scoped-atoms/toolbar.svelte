<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";

  const atom = Draft.use();
  const draft = useAtom(atom);
  const words = $derived(draft.current.split(/\s+/u).filter(Boolean).length);
</script>

<DraftPart {atom} name="Toolbar">
  <div class="flex items-center justify-between gap-2">
    <span class="text-sm">{words} {words === 1 ? "word" : "words"}</span>
    <button class="mr-0!" onclick={() => (draft.current = "")}>Clear</button>
  </div>
</DraftPart>
