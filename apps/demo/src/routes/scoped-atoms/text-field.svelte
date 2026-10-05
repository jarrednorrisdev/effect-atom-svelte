<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";

  const draft = useAtom(Draft.use());
</script>

<DraftPart name="TextField">
  <input
    aria-label="Draft"
    bind:value={draft.current}
    class="w-full"
    placeholder="Try *italic* or **bold**"
  />
</DraftPart>
