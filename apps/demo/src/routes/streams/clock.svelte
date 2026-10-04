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

  const clock = useAtomValue(clockAtom);
</script>

<p>
  Seconds on this page:
  <output data-testid="clock">
    {AsyncResult.getOrElse(clock.current, () => "starting")}
  </output>
</p>
