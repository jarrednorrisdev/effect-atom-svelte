<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { afterAwaitAtom, keptAtom, record } from "./revalidate.ts";

  const kept = await useAtomResult(keptAtom);
  // Called after the script's first await, when Svelte is no longer hydrating.
  const afterAwait = await useAtomResult(afterAwaitAtom);

  $effect.pre(() => record("kept", kept.current));
  $effect.pre(() => record("after-await", afterAwait.current));
</script>

<output>{kept.current._tag === "Success" ? kept.current.value : kept.current._tag}</output>
<output>{afterAwait.current._tag === "Success" ? afterAwait.current.value : afterAwait.current._tag}</output>
