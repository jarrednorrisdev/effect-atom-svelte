<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const greetingAtom = Atom.make(
    Effect.gen(function* () {
      yield* Effect.sleep("2 seconds");
      // The time tells a new greeting apart from the old one.
      const time = new Date().toLocaleTimeString();
      return `Hello from an Effect at ${time}`;
    })
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
  import Parts from "#lib/docs/kit/parts.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const greeting = useAtomSuspense(greetingAtom);
  // True while the effect runs again.
  const reloading = useAtomValue(greetingAtom, (result) => result.waiting);
  const reload = useAtomRefresh(greetingAtom);
</script>

<Parts>
  <Part code label="countAtom">
    <FlashValue big data-testid="taste-count" value={count.current} />
    {#snippet actions()}
      <button data-cue="up" onclick={() => (count.current += 1)}>
        Add one
      </button>
    {/snippet}
  </Part>
  <Arrow label="get" pulse={count.current} />
  <Part code label="doubledAtom">
    <FlashValue big data-testid="taste-doubled" value={doubled.current} />
  </Part>
  <Part code label="greetingAtom">
    <svelte:boundary>
      <ResultChip
        busy={reloading.current}
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
    {#snippet actions()}
      <button onclick={reload}>Load again</button>
    {/snippet}
  </Part>
</Parts>
