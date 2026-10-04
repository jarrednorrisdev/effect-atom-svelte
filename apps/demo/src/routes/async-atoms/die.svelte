<script module lang="ts">
  import { Effect, Random } from "effect";
  import { Atom } from "effect/reactivity";

  // An Effect that takes a moment, as a request would. The atom runs it when first
  // read.
  const dieAtom = Atom.make(
    Random.nextIntBetween(1, 6).pipe(Effect.delay("600 millis"))
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomValue } from "effect-atom-svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
</script>

<p>
  <button onclick={roll}>Roll again</button>
  {#if die.current._tag === "Success"}
    <output data-testid="die" aria-busy={die.current.waiting}>
      {die.current.value}
    </output>
  {:else if die.current._tag === "Initial"}
    <span>Rolling…</span>
  {/if}
</p>
<p>
  State:
  <output data-testid="die-state">
    {die.current._tag}{die.current.waiting ? ", waiting" : ""}
  </output>
</p>
