<script lang="ts">
  import { Effect, Random } from "effect";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  let promiseRuns = $state(0);
  let effectRuns = $state(0);
  let fromPromise = $state<number>();
  let fromEffect = $state<number>();

  // A promise API: calling it does the work and returns a promise of the result.
  const rollDie = () => {
    promiseRuns += 1;
    return Promise.resolve(Math.floor(Math.random() * 6) + 1);
  };

  // A promise exists only once the work has started, and it settles once.
  const promise = rollDie();

  // An effect only describes the work: creating it runs nothing.
  const roll = Random.nextIntBetween(1, 6).pipe(
    Effect.tap(() => Effect.sync(() => (effectRuns += 1)))
  );

  const awaitPromise = async () => {
    fromPromise = await promise;
  };
  // Each run does the work again.
  const runEffect = async () => {
    fromEffect = await Effect.runPromise(roll);
  };
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part count={promiseRuns} countLabel="runs" label="A promise">
    <button onclick={awaitPromise}>Await the promise</button>
    <p class="mt-3">
      <ResultChip tone={fromPromise === undefined ? "idle" : "success"}>
        <FlashValue data-testid="lazy-promise" value={fromPromise ?? "–"} />
      </ResultChip>
    </p>
  </Part>
  <Part count={effectRuns} countLabel="runs" label="An effect">
    <button onclick={runEffect}>Run the effect</button>
    <p class="mt-3">
      <ResultChip tone={fromEffect === undefined ? "idle" : "success"}>
        <FlashValue data-testid="lazy-effect" value={fromEffect ?? "–"} />
      </ResultChip>
    </p>
  </Part>
</div>
