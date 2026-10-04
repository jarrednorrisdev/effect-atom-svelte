<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const greetingAtom = Atom.make(
    Effect.succeed("Hello from an Effect").pipe(Effect.delay("2 seconds"))
  );
</script>

<script lang="ts">
  import {
    useAtom,
    useAtomRefresh,
    useAtomSuspense,
    useAtomValue,
  } from "effect-atom-svelte";
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  // suspendOnWaiting: a refresh waits for the new greeting instead of keeping the old one.
  const greeting = useAtomSuspense(greetingAtom, { suspendOnWaiting: true });
  const reload = useAtomRefresh(greetingAtom);
</script>

<div class="flex flex-wrap gap-3">
  <Part code label="countAtom">
    <span class="button-group">
      <button onclick={() => (count.current += 1)}>Add one</button>
      <FlashValue data-testid="taste-count" value={count.current} />
    </span>
  </Part>
  <Arrow label="get" pulse={count.current} />
  <Part code label="doubledAtom">
    <FlashValue data-testid="taste-doubled" value={doubled.current} />
  </Part>
  <Part code label="greetingAtom">
    <svelte:boundary>
      <ResultChip
        busy={$effect.pending() > 0}
        data-testid="taste-greeting"
        kind="message"
        tone="success"
      >
        {await greeting.current}
      </ResultChip>
      {#snippet pending()}
        <ResultChip kind="message" tone="running">Loading…</ResultChip>
      {/snippet}
    </svelte:boundary>
    <p class="mt-2"><button onclick={reload}>Load again</button></p>
  </Part>
</div>
