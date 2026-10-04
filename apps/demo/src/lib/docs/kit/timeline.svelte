<!--
  @component
  Log entries as dots on a time axis, one row per lane, like the schedule tracks on
  effect.kitlangton.com. It shows when things happened relative to each other: two boundaries
  resolving at different times, a refresh and the value that follows it. Each dot has its tone's
  color and drops onto its track with a spring as it happens (Motion); its label shows on hover and is read out by screen readers.

  ```svelte
  <Timeline entries={log.entries} lanes={["default", "suspendOnWaiting"]} />
  ```

  Entries come from an `EventLogState`; give each a `lane`. Without `lanes`, every entry goes on
  one unlabeled row. The axis runs from 0 to `span` ms, or to the last entry plus a margin.

  Pass `now` (milliseconds on the same clock as the entries) to draw a cursor across the tracks
  while something is in progress, such as a refresh that hasn't settled; leave it out otherwise.
-->
<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import type { LogEntry } from "./event-log.svelte.ts";
  import { enter } from "./motion.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly entries: readonly LogEntry[];
    /** Row names, top to bottom, matching the entries' `lane`. */
    readonly lanes?: readonly string[];
    /** Where to draw a "now" cursor, in milliseconds; no cursor when left out. */
    readonly now?: number | undefined;
    /** The length of the axis in milliseconds; fits the entries by default. */
    readonly span?: number;
  }

  const { entries, lanes, now, span, ...rest }: Props = $props();

  const rows = $derived(lanes ?? [undefined]);
  const length = $derived(
    span ?? Math.max(1000, Math.ceil((Math.max(0, ...entries.map((e) => e.at)) * 1.15) / 500) * 500)
  );
  const left = (at: number) => `${Math.min(100, (at / length) * 100)}%`;
</script>

<div class={["timeline not-prose", lanes !== undefined && "with-lanes"]} {...rest}>
  {#each rows as lane (lane)}
    {#if lane !== undefined}<span class="lane">{lane}</span>{/if}
    <div class="track-box">
      <ol aria-label={lane ?? "Timeline"} class="track">
        {#each entries.filter((entry) => lane === undefined || entry.lane === lane) as entry (entry.id)}
          <li
            class="dot"
            data-tone={entry.tone}
            style:left={left(entry.at)}
            title="{entry.label} at {entry.at} ms"
            {@attach enter({ scale: [0, 1], y: [-10, 0] })}
          >
            <span class="sr-only">{entry.label} at {entry.at} ms</span>
          </li>
        {/each}
      </ol>
      {#if now !== undefined}
        <span aria-hidden="true" class="cursor" style:left={left(now)}></span>
      {/if}
    </div>
  {/each}
  <div aria-hidden="true" class="axis">
    <span>0 ms</span>
    <span>{length} ms</span>
  </div>
</div>

<style>
  .timeline {
    align-items: center;
    display: grid;
    gap: 0.6rem 0.75rem;
    grid-template-columns: 1fr;
    margin-top: 1rem;
  }
  .with-lanes {
    grid-template-columns: auto 1fr;
  }
  .lane,
  .axis {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .track {
    background: repeating-linear-gradient(
      90deg,
      var(--border) 0 1px,
      transparent 1px 10%
    );
    border-bottom: 2px solid var(--border-strong);
    height: 1.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }
  .track-box {
    position: relative;
  }
  /* The "now" cursor: a thin line in the running color over the track. */
  .cursor {
    background: var(--tone-running);
    bottom: -0.3rem;
    pointer-events: none;
    position: absolute;
    top: -0.3rem;
    width: 2px;
  }
  .dot {
    --mark: var(--tone-idle);
    background: var(--mark);
    border: 2px solid var(--background);
    border-radius: 999px;
    bottom: -0.4rem;
    height: 0.8rem;
    margin-left: -0.4rem;
    position: absolute;
    width: 0.8rem;
  }
  .dot[data-tone="running"] {
    --mark: var(--tone-running);
  }
  .dot[data-tone="success"] {
    --mark: var(--tone-success);
  }
  .dot[data-tone="failure"] {
    --mark: var(--tone-failure);
  }
  .dot[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
  }
  .axis {
    display: flex;
    grid-column: -2 / -1;
    justify-content: space-between;
    margin-top: -0.2rem;
  }
</style>
