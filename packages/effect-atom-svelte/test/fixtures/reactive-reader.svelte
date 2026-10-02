<script lang="ts">
  import { useAtomResult, useAtomSet, useAtomSuspense } from "../../src/index.ts";
  import { mutate, reactiveQuery } from "./reactive-query.ts";

  interface Props {
    readonly revalidateOnHydrate?: boolean | undefined;
  }

  const { revalidateOnHydrate }: Props = $props();
  // svelte-ignore state_referenced_locally
  const suspended = useAtomSuspense(reactiveQuery, { revalidateOnHydrate });
  // svelte-ignore state_referenced_locally
  const result = await useAtomResult(reactiveQuery, { revalidateOnHydrate });
  const run = useAtomSet(mutate);
</script>

<button onclick={() => run()}>mutate</button>
<output>{await suspended.current}</output>
<output>{result.current._tag === "Success" ? result.current.value : result.current._tag}</output>
