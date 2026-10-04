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
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
  const loaded = useAtom(loadedAtom);
</script>

<!-- loadedAtom picks the runtime's layer, and dieAtom rolls with its Dice. -->
<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
  <Part code label="loadedAtom">
    <button
      aria-pressed={loaded.current}
      onclick={() => (loaded.current = !loaded.current)}
    >
      Loaded dice
    </button>
  </Part>
  <span
    aria-hidden="true"
    class="rotate-90 self-center text-muted-foreground sm:rotate-0"
  >
    →
  </span>
  <Part code label="runtime" tone="success">
    layer
    <FlashValue
      data-testid="service-layer"
      value={loaded.current ? "LoadedDiceLayer" : "FairDiceLayer"}
    />
  </Part>
  <span
    aria-hidden="true"
    class="rotate-90 self-center text-muted-foreground sm:rotate-0"
  >
    →
  </span>
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
  </Part>
</div>
<p class="mt-4 flex flex-wrap items-center gap-3">
  <button onclick={roll}>Roll again</button>
  <StateBadge data-testid="service-state" result={die.current} />
</p>

