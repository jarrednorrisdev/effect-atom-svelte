<script module lang="ts">
  import { Data, Effect, Random } from "effect";
  import { Atom } from "effect/reactivity";

  class DieDropped extends Data.TaggedError("DieDropped") {}

  // Ticked by the checkbox below.
  const failAtom = Atom.make(false);

  // The atom runs the Effect when first read, and again whenever failAtom changes,
  // because it reads failAtom with get.
  const dieAtom = Atom.make((get) => {
    const fail = get(failAtom);
    return Effect.gen(function* rollDie() {
      // Takes a moment, as a request would.
      yield* Effect.sleep("600 millis");
      if (fail) {
        return yield* new DieDropped();
      }
      return yield* Random.nextIntBetween(1, 6);
    });
  });
</script>

<script lang="ts">
  import { useAtom, useAtomRefresh, useAtomValue } from "effect-atom-svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
  const fail = useAtom(failAtom);
</script>

<p>
  <button onclick={roll}>Roll again</button>
  <label><input bind:checked={fail.current} type="checkbox" /> Drop the die</label>
</p>
<p>
  {#if die.current._tag === "Success"}
    Rolled
    <output data-testid="die" aria-busy={die.current.waiting}>
      {die.current.value}
    </output>
  {:else if die.current._tag === "Failure"}
    <span data-testid="die-failure">The die fell off the table.</span>
  {:else}
    <span>Rolling…</span>
  {/if}
</p>
<p>
  State:
  <output data-testid="die-state">
    {die.current._tag}{die.current.waiting ? ", waiting" : ""}
  </output>
</p>
