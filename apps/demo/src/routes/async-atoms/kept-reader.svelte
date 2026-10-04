<script lang="ts">
  import type { Atom, AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<number>>;
    readonly name: string;
  }

  const { atom, name }: Props = $props();
  // svelte-ignore state_referenced_locally
  const loads = useAtomValue(atom);
</script>

<p class="mt-3">
  {#if loads.current._tag === "Success"}
    <ResultChip kind="message" tone="success">
      <span data-testid="kept-{name}">
        Loaded {loads.current.value} time{loads.current.value === 1 ? "" : "s"}
      </span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" tone="running">Loading…</ResultChip>
  {/if}
</p>
