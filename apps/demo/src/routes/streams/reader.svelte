<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  import { clockAtom } from "./clock.ts";

  const { name }: { name: string } = $props();

  const clock = useAtomValue(clockAtom);
</script>

<p class="m-0 flex flex-wrap items-center gap-3">
  Seconds since it started:
  <FlashValue
    data-testid="clock-{name}"
    value={AsyncResult.getOrElse(clock.current, () => "starting")}
  />
  <!-- Success, waiting: the stream has emitted and is still running. -->
  <StateBadge data-testid="clock-{name}-state" result={clock.current} />
</p>
