<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { Draft } from "./draft-scope.ts";
  import { providerOf } from "./providers.ts";

  const atom = Draft.use();
  const draft = useAtom(atom);
</script>

<Part code label="TextField: Draft.use() → {providerOf(atom)}">
  <input
    aria-label="Draft"
    bind:value={draft.current}
    class="w-full"
    placeholder="Try *italic* or **bold**"
  />
</Part>
