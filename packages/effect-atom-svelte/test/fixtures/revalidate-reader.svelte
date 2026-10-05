<script lang="ts">
  import { useAtomResult, useAtomSuspense } from "../../src/index.ts";
  import { record, resultAtom, suspenseAtom } from "./revalidate.ts";

  // Both hooks are called before the script's first await, while Svelte is still hydrating.
  // includeFailure resolves with the result itself, so the test can see whether it is waiting.
  const suspense = useAtomSuspense(suspenseAtom, {
    includeFailure: true,
    revalidateOnHydrate: true,
  });
  const result = await useAtomResult(resultAtom, { revalidateOnHydrate: true });
  const suspended = $derived(await suspense.current);

  // Browser only: effects don't run on the server.
  $effect.pre(() => record("result", result.current));
  $effect.pre(() => record("suspense", suspended));
</script>

<output>{result.current._tag === "Success" ? result.current.value : result.current._tag}</output>
<output>{suspended._tag === "Success" ? suspended.value : suspended._tag}</output>
