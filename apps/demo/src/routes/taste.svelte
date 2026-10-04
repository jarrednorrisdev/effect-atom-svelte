<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const greetingAtom = Atom.make(
    Effect.succeed("Hello from an Effect").pipe(Effect.delay("500 millis"))
  );
</script>

<script lang="ts">
  import { useAtom, useAtomSuspense, useAtomValue } from "effect-atom-svelte";
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const greeting = useAtomSuspense(greetingAtom);
</script>

<div class="flex flex-wrap items-center gap-3">
  <Part code label="countAtom">
    <button onclick={() => (count.current += 1)}>Add one</button>
    <FlashValue data-testid="taste-count" value={count.current} />
  </Part>
  <Arrow label="get" pulse={count.current} />
  <Part code label="doubledAtom">
    <FlashValue data-testid="taste-doubled" value={doubled.current} />
  </Part>
  <Part code label="greetingAtom">
    <svelte:boundary>
      <ResultChip data-testid="taste-greeting" kind="message" tone="success">
        {await greeting.current}
      </ResultChip>
      {#snippet pending()}
        <ResultChip kind="message" tone="running">Loading…</ResultChip>
      {/snippet}
    </svelte:boundary>
  </Part>
</div>
