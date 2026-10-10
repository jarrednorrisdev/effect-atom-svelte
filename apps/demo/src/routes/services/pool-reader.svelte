<script lang="ts">
  import type { Atom, AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<number>>;
    readonly name: string;
  }

  const { atom, name }: Props = $props();
  // A getter, so the hook follows the prop.
  const pool = useAtomValue(() => atom);
</script>

<p class="mt-3">
  {#if pool.current._tag === "Success"}
    <ResultChip kind="message" tone="success">
      <span data-testid="pool-{name}">Uses pool {pool.current.value}</span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" tone="running">Building…</ResultChip>
  {/if}
</p>
