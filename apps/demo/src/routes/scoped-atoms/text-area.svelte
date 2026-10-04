<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";

  const draft = useAtom(Draft.use());
</script>

<Part code label="TextArea: Draft.use()">
  <textarea
    bind:value={draft.current}
    class="w-full"
    placeholder="Write a note"
    rows="2"
  ></textarea>
</Part>
