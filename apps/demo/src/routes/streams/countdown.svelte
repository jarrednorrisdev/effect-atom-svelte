<script module lang="ts">
  import { Data, Effect, Option, Stream } from "effect";
  import { Atom } from "effect/reactivity";

  class SignalLost extends Data.TaggedError("SignalLost") {}

  // 3, 2, 1, half a second apart.
  const countdown = Stream.paginate(3, (n) =>
    Effect.succeed([[n], n > 1 ? Option.some(n - 1) : Option.none()] as const).pipe(
      Effect.delay("500 millis")
    )
  );

  // Three ways for the stream to finish.
  const endings = new Map<string, Stream.Stream<number, SignalLost>>([
    ["Ends", countdown],
    ["Fails", countdown.pipe(Stream.concat(Stream.fail(new SignalLost())))],
    ["Emits nothing", Stream.fromEffectDrain(Effect.sleep("500 millis"))],
  ]);

  // One atom per ending, so each starts with no earlier value.
  const countdownAtom = Atom.family((ending: string) =>
    // Kept off the server, which would otherwise run it until the render ended.
    Atom.make(endings.get(ending) ?? countdown).pipe(Atom.withServerValueInitial)
  );
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomRefresh, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import Emitted from "./emitted.svelte";

  let ending = $state("Ends");
  const count = useAtomValue(() => countdownAtom(ending));
  const restart = useAtomRefresh(() => countdownAtom(ending));
</script>

<p class="flex flex-wrap items-center gap-4">
  <span aria-label="How the stream finishes" class="flex flex-wrap gap-2" role="group">
    {#each [...endings.keys()] as name (name)}
      <button aria-pressed={ending === name} onclick={() => (ending = name)}>
        {name}
      </button>
    {/each}
  </span>
  <button data-cue="start" onclick={restart}>Restart</button>
</p>
<Emitted result={count.current} />
<p class="flex flex-wrap items-center gap-3">
  Latest item:
  <!-- A failure keeps the last item, so getOrElse still shows it. -->
  <FlashValue
    data-testid="countdown"
    value={AsyncResult.getOrElse(count.current, () => "none")}
  />
  <StateBadge data-testid="countdown-state" result={count.current} />
</p>
<CauseView
  cause={count.current._tag === "Failure" ? count.current.cause : undefined}
  data-testid="countdown-cause"
/>
<ResultHistory label="Countdown" max={7} result={count.current} />
