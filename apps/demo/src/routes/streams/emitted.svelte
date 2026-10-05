<!--
  The countdown example's run so far: each item the stream emitted, then how it finished. A run
  starts when the result goes back to waiting. Not part of the example's code.
-->
<script lang="ts">
  import { Cause, Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { untrack } from "svelte";

  interface Props {
    readonly result: AsyncResult.AsyncResult<number, unknown>;
  }

  interface Ending {
    readonly failed: boolean;
    readonly text: string;
  }

  const { result }: Props = $props();

  let items = $state<number[]>([]);
  let ending = $state<Ending>();
  let wasWaiting = false;

  const tagOf = (error: unknown) =>
    typeof error === "object" && error !== null && "_tag" in error
      ? String(error._tag)
      : "failed";

  const track = (now: AsyncResult.AsyncResult<number, unknown>) => {
    const started = now.waiting && !wasWaiting;
    wasWaiting = now.waiting;
    if (started) {
      // A restart keeps the last run's item while it waits: that isn't a new one.
      items = [];
      ending = undefined;
      return;
    }
    // A failure keeps the last item, so an item that arrived just before it is still seen.
    const item = AsyncResult.getOrElse(now, () => undefined);
    if (item !== undefined && item !== items.at(-1)) {
      items.push(item);
    }
    if (now._tag === "Failure") {
      const error = Cause.findErrorOption(now.cause);
      ending = { failed: true, text: Option.isSome(error) ? tagOf(error.value) : "failed" };
    } else if (now._tag === "Success" && !now.waiting) {
      ending = { failed: false, text: "ended" };
    }
  };

  $effect(() => {
    const now = result;
    untrack(() => track(now));
  });
</script>

<p class="flex flex-wrap items-center gap-2" data-testid="countdown-emitted">
  Emitted:
  {#each items as item, index (index)}
    <output>{item}</output>
    <span aria-hidden="true" class="text-muted-foreground">→</span>
  {/each}
  {#if ending}
    <output class="ending" data-tone={ending.failed ? "failure" : "success"}>
      {ending.failed ? "✗" : "✓"}
      {ending.text}
    </output>
  {:else}
    <span class="text-muted-foreground">…</span>
  {/if}
</p>

<style>
  .ending[data-tone="success"] {
    background: color-mix(in oklab, var(--tone-success) 12%, transparent);
    color: var(--tone-success-text);
  }
  .ending[data-tone="failure"] {
    background: color-mix(in oklab, var(--tone-failure) 12%, transparent);
    color: var(--tone-failure-text);
  }
</style>
