<script lang="ts">
  import { Effect, Random } from "effect";
  import Part from "#lib/docs/kit/part.svelte";

  // How many times each die was really rolled, and what each click got back.
  let promiseRolls = $state(0);
  let effectRolls = $state(0);
  let fromPromise = $state<number[]>([]);
  let fromEffect = $state<number[]>([]);

  // A promise API: calling it does the work and returns a promise of the result.
  const rollDie = () => {
    promiseRolls += 1;
    return Promise.resolve(Math.floor(Math.random() * 6) + 1);
  };

  // A promise exists only once the work has started, and it settles once.
  const promise = rollDie();

  // An effect only describes the work: creating it runs nothing.
  const roll = Random.nextIntBetween(1, 6).pipe(
    Effect.tap(() => Effect.sync(() => (effectRolls += 1)))
  );

  const awaitPromise = async () => {
    fromPromise = [...fromPromise, await promise];
  };
  // Each run does the work again.
  const runEffect = async () => {
    fromEffect = [...fromEffect, await Effect.runPromise(roll)];
  };
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="Promise<number>">
    <button onclick={awaitPromise}>Await the promise</button>
    <p class="text-sm">
      Rolled <strong data-testid="promise-rolls">{promiseRolls}</strong>
      {promiseRolls === 1 ? "time" : "times"}, when the page loaded.
    </p>
    <ol
      aria-label="Promise results"
      class="m-0 flex list-none flex-wrap gap-1.5 p-0"
      data-testid="lazy-promise"
    >
      {#each fromPromise as value, index (index)}
        <li class="m-0"><output>{value}</output></li>
      {/each}
    </ol>
  </Part>
  <Part code label="Effect<number>">
    <button onclick={runEffect}>Run the effect</button>
    <p class="text-sm">
      Rolled <strong data-testid="effect-rolls">{effectRolls}</strong>
      {effectRolls === 1 ? "time" : "times"}, once per run.
    </p>
    <ol
      aria-label="Effect results"
      class="m-0 flex list-none flex-wrap gap-1.5 p-0"
      data-testid="lazy-effect"
    >
      {#each fromEffect as value, index (index)}
        <li class="m-0"><output>{value}</output></li>
      {/each}
    </ol>
  </Part>
</div>
