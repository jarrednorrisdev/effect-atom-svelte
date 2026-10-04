<script module lang="ts">
  import { Data, Effect, Random } from "effect";
  import { Atom } from "effect/reactivity";

  class Offline extends Data.TaggedError("Offline") {}

  // Ticked by the checkbox below.
  const offlineAtom = Atom.make(false);

  // A sensor reading that takes a moment, and fails while the sensor is offline.
  const temperatureAtom = Atom.make((get) => {
    const offline = get(offlineAtom);
    return Effect.gen(function* readSensor() {
      yield* Effect.sleep("500 millis");
      if (offline) {
        return yield* new Offline();
      }
      return yield* Random.nextIntBetween(12, 30);
    });
  });
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtom, useAtomRefresh, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";

  const reading = useAtomValue(temperatureAtom);
  const refresh = useAtomRefresh(temperatureAtom);
  const offline = useAtom(offlineAtom);

  // One function for each state.
  const label = $derived(
    AsyncResult.match(reading.current, {
      onFailure: () => "The sensor is offline",
      onInitial: () => "Reading…",
      onSuccess: (success) => `${success.value} °C`,
    })
  );

  // The value, or the last one before a failure, or the fallback.
  const lastKnown = $derived(
    AsyncResult.getOrElse(reading.current, () => "none yet")
  );
</script>

<p class="flex flex-wrap items-center gap-3">
  <button onclick={refresh}>Read again</button>
  <label><input bind:checked={offline.current} type="checkbox" /> Offline</label>
  <StateBadge data-testid="sensor-state" result={reading.current} />
</p>
<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="AsyncResult.match">
    <ResultChip
      busy={reading.current.waiting}
      kind="message"
      tone={toneOf(reading.current)}
    >
      <span data-testid="sensor-match">{label}</span>
    </ResultChip>
  </Part>
  <Part code label="AsyncResult.getOrElse">
    <ResultChip
      busy={reading.current.waiting}
      kind="message"
      tone={lastKnown === "none yet" ? "idle" : "success"}
    >
      <span data-testid="sensor-last">{lastKnown}</span>
    </ResultChip>
  </Part>
</div>
