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
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const die = useAtomValue(dieAtom);
  const roll = useAtomRefresh(dieAtom);
  const fail = useAtom(failAtom);
</script>

<p>
  <button onclick={roll}>Roll again</button>
  <label><input bind:checked={fail.current} type="checkbox" /> Drop the die</label>
</p>
<div class="flex flex-wrap items-center gap-4">
  {#if die.current._tag === "Success"}
    <ResultChip busy={die.current.waiting} label="dieAtom" tone="success">
      <span data-testid="die">{die.current.value}</span>
    </ResultChip>
  {:else if die.current._tag === "Failure"}
    <ResultChip
      busy={die.current.waiting}
      kind="message"
      label="dieAtom"
      tone="failure"
    >
      <span data-testid="die-failure">The die fell off the table.</span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="dieAtom" tone="running">Rolling…</ResultChip>
  {/if}
  <StateBadge data-testid="die-state" result={die.current} />
</div>
<ResultHistory result={die.current} />
