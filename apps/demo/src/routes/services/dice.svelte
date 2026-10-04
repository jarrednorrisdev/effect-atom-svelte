<script module lang="ts">
  import { Context, Effect, Layer, Random } from "effect";
  import { Atom } from "effect/reactivity";

  // A service: what it offers, and a tag that effects ask for it by.
  class Dice extends Context.Service<
    Dice,
    { readonly roll: Effect.Effect<number> }
  >()("demo/Dice") {
    // Two ways to build it. Each roll takes a moment, as a request would.
    static readonly fair = Layer.succeed(Dice, {
      roll: Random.nextIntBetween(1, 6).pipe(Effect.delay("600 millis")),
    });
    static readonly loaded = Layer.succeed(Dice, {
      roll: Effect.succeed(6).pipe(Effect.delay("600 millis")),
    });
  }

  const loadedAtom = Atom.make(false);

  // The runtime picks its layer with get, so it builds the other one when
  // loadedAtom changes, and every atom it made runs again.
  const runtime = Atom.runtime((get) => (get(loadedAtom) ? Dice.loaded : Dice.fair));

  const dieAtom = runtime.atom(Dice.use((dice) => dice.roll));
</script>

<script lang="ts">
  import { useAtom, useAtomRefresh, useAtomValue } from "effect-atom-svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
  const loaded = useAtom(loadedAtom);
</script>

<p>
  <button onclick={roll}>Roll again</button>
  <label><input bind:checked={loaded.current} type="checkbox" /> Loaded dice</label>
</p>
<p>
  {#if die.current._tag === "Success"}
    Rolled
    <output data-testid="service-die" aria-busy={die.current.waiting}>
      {die.current.value}
    </output>
  {:else}
    <span>Rolling…</span>
  {/if}
</p>
