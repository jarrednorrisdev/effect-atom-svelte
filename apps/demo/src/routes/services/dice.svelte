<script module lang="ts">
  import { Context, Effect, Layer, Random } from "effect";
  import { Atom } from "effect/reactivity";

  // A service: what it offers, and a tag that effects ask for it by.
  class Dice extends Context.Service<
    Dice,
    { readonly roll: Effect.Effect<number> }
  >()("demo/Dice") {}

  // Two ways to build it. Each roll takes a moment, as a request would.
  const FairDiceLayer = Layer.succeed(Dice, {
    roll: Random.nextIntBetween(1, 6).pipe(Effect.delay("600 millis")),
  });
  const LoadedDiceLayer = Layer.succeed(Dice, {
    roll: Effect.succeed(6).pipe(Effect.delay("600 millis")),
  });

  const loadedAtom = Atom.make(false);

  // The runtime picks its layer with get, so it builds the other one when
  // loadedAtom changes, and every atom it made runs again.
  const runtime = Atom.runtime((get) =>
    get(loadedAtom) ? LoadedDiceLayer : FairDiceLayer
  );

  const dieAtom = runtime.atom(Dice.use((dice) => dice.roll));
</script>

<script lang="ts">
  import { useAtom, useAtomRefresh, useAtomValue } from "effect-atom-svelte";
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Parts from "#lib/docs/kit/parts.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
  const loaded = useAtom(loadedAtom);
</script>

<!-- loadedAtom picks the runtime's layer, and dieAtom rolls with its Dice. -->
<Parts>
  <Part code label="loadedAtom">
    <FlashValue big value={loaded.current} />
    {#snippet actions()}
      <button
        aria-pressed={loaded.current}
        onclick={() => (loaded.current = !loaded.current)}
      >
        Loaded dice
      </button>
    {/snippet}
  </Part>
  <Arrow label="get" pulse={loaded.current} />
  <Part code label="runtime" tone="success">
    <FlashValue
      big
      data-testid="service-layer"
      value={loaded.current ? "LoadedDiceLayer" : "FairDiceLayer"}
    />
  </Part>
  <Arrow label="Dice" pulse={loaded.current} />
  <Part code label="dieAtom" tone={die.current.waiting ? "running" : "success"}>
    {#if die.current._tag === "Success"}
      <ResultChip
        busy={die.current.waiting}
        data-testid="service-die"
        tone="success"
      >
        {die.current.value}
      </ResultChip>
    {:else}
      <ResultChip kind="message" tone="running">Rolling…</ResultChip>
    {/if}
    {#snippet actions()}
      <button onclick={roll}>Roll again</button>
      <StateBadge data-testid="service-state" result={die.current} />
    {/snippet}
  </Part>
</Parts>
