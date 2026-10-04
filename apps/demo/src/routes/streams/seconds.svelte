<script module lang="ts">
  import { Stream } from "effect";
  import { Atom } from "effect/reactivity";

  // Counts the seconds since something started reading it. withServerValueInitial
  // keeps it off the server, which would otherwise run it until the render ended.
  const clockAtom = Atom.make(
    Stream.tick("1 second").pipe(Stream.scan(() => 0, (n) => n + 1))
  ).pipe(Atom.withServerValueInitial);
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import Cue from "#lib/docs/kit/cue.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const clock = useAtomValue(clockAtom);
</script>

<p class="flex flex-wrap items-center gap-3">
  Seconds on this page:
  <FlashValue
    data-testid="clock"
    value={AsyncResult.getOrElse(clock.current, () => "starting")}
  />
  <!-- Success, waiting: the stream has emitted and is still running. -->
  <StateBadge data-testid="clock-state" result={clock.current} />
  <Cue cue="tick" on={clock.current} />
</p>
