<script lang="ts">
  import { onMount } from "svelte";

  import { useAtomSuspense, useAtomValue } from "../../src/index.ts";
  import { savedFilterAtom } from "./browser-choice.ts";
  import { listFor } from "./seeded-list.ts";

  interface Props {
    /** Keep the server's choice until mounted, the fix the README recommends. */
    readonly afterMount: boolean;
  }

  const { afterMount }: Props = $props();
  const saved = useAtomValue(savedFilterAtom);
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
  const list = useAtomSuspense(() =>
    listFor(afterMount && !mounted ? "a" : saved.current)
  );
</script>

<output>{await list.current}</output>
