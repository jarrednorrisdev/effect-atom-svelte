<script lang="ts">
  import type { Atom, AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly label: string;
  }

  const { atom, label }: Props = $props();
  // A getter, so the hook follows the prop.
  const result = useAtomValue(() => atom);
</script>

<p class="my-1 flex items-center gap-3">
  <span class="w-16 text-sm">{label}</span>
  {#if result.current._tag === "Success"}
    <ResultChip kind="message" tone="success">
      <span data-testid="kept-{label}">{result.current.value}</span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" tone="running">
      <span data-testid="kept-{label}">Loading…</span>
    </ResultChip>
  {/if}
</p>
