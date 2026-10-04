<!--
  @component
  What one side of the suspendOnWaiting example does, beside it rather than in its code: the atom's
  own `AsyncResult` as the registry has it, and what the side's `await` resolved with, on a
  timeline and in a log, timed from the latest refresh.

  It reads the registry directly, not through Svelte: while a boundary waits, Svelte holds back
  every change in the same update, and this shows what happens meanwhile. Each entry is written in
  a task of its own (`setTimeout`), so it is a separate update that Svelte shows at once.
-->
<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomSubscribe } from "effect-atom-svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import { reducedMotion } from "#lib/docs/kit/motion.ts";
  import { play } from "#lib/docs/kit/sound.ts";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import Timeline from "#lib/docs/kit/timeline.svelte";
  import { exampleTouched, getExampleState, toneOf } from "#lib/docs/kit/tone.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
    /** How the side reads the atom, for the caption while it refreshes. */
    readonly mode: "default" | "suspendOnWaiting";
    /** The atom's name, as the example calls it. */
    readonly name: string;
    /** The promise the side's boundary awaits right now. */
    readonly read: () => Promise<string>;
  }

  const { atom, mode, name, read, ...rest }: Props = $props();

  const example = getExampleState();
  const log = new EventLogState();
  let result = $state<AsyncResult.AsyncResult<string>>(AsyncResult.initial(true));
  let startedAt = performance.now();
  let now = $state<number>();
  // The last value an await resolved with since the refresh began; a second promise for the same
  // value (the settled result after a wait) adds nothing to show.
  let resolved: string | undefined;

  const describe = (current: AsyncResult.AsyncResult<string>) =>
    `${current._tag}${current.waiting ? ", waiting" : ""}`;

  /** Runs `f` as its own update, after Svelte has taken the current one. */
  const later = (f: () => void) => setTimeout(f, 0);

  const watch = async (promise: Promise<string>) => {
    try {
      const value = await promise;
      later(() => {
        if (value === resolved) {
          return;
        }
        resolved = value;
        log.add(`resolved with ${value}`, { lane: "await", tone: "success" });
        if (exampleTouched(example)) {
          play("tick");
        }
      });
    } catch {
      // An abandoned wait rejects; the boundary awaits a newer promise instead.
    }
  };

  let previous: AsyncResult.AsyncResult<string> | undefined;
  useAtomSubscribe(
    () => atom,
    (current) => {
      // A refresh starts when a settled result begins waiting: time starts again from there.
      const restarted =
        previous !== undefined && !previous.waiting && current.waiting;
      previous = current;
      // The promise the boundary gets for this result, read now, while it is current.
      const promise = read();
      later(() => {
        if (restarted) {
          log.clear();
          resolved = undefined;
          startedAt = performance.now();
        }
        result = current;
        log.add(describe(current), {
          lane: "atom",
          tone: current.waiting ? "running" : toneOf(current),
        });
      });
      void watch(promise);
    },
    { immediate: true }
  );

  // While the atom waits, a cursor runs along the timeline.
  $effect(() => {
    if (!result.waiting || reducedMotion()) {
      now = undefined;
      return undefined;
    }
    let frame = requestAnimationFrame(function tick() {
      now = performance.now() - startedAt;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="trace" {...rest}>
  <p class="atom">
    <span class="name">{name}</span>
    <StateBadge data-testid="{name}-state" {result} />
  </p>
  {#if result.waiting && result._tag === "Success"}
    <p class="caption" data-testid="{name}-caption">
      {mode === "default"
        ? "The await resolved at once, with the old value."
        : "The await is waiting for the new value."}
    </p>
  {/if}
  <Timeline entries={log.entries} lanes={["atom", "await"]} {now} span={2500} />
</div>

<style>
  .trace {
    margin-top: 0.75rem;
  }
  .atom {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
  }
  .caption {
    color: var(--muted-foreground);
    font-size: 0.8rem;
    margin: 0.4rem 0 0;
  }
  .name {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
</style>
