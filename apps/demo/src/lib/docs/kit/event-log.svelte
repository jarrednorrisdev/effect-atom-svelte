<!--
  @component
  A short list of what happened and when, newest last, each entry with its time in milliseconds
  and a dot in its tone. New entries slide in with a spring, staggered when several arrive at once (Motion). Feed it from an `EventLogState`
  (`event-log.svelte.ts`), or use `ResultHistory` to log an `AsyncResult` without code in the
  example.

  ```svelte
  <EventLog entries={log.entries} label="Events" />
  ```

  Each entry is an `<li>` with `data-tone`. Other attributes go on the wrapper, which is there even
  while the log is empty, so tests can read the entries in order:
  `getByTestId("x-log").getByRole("listitem")`.
-->
<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import type { LogEntry } from "./event-log.svelte.ts";
  import { enter } from "./motion.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Shows the label as code, in its own case (`socketAtom`), as `Part` does. */
    readonly code?: boolean;
    /** Shown while there are no entries. */
    readonly empty?: string;
    readonly entries: readonly LogEntry[];
    /** A caption above the list, which also names it for screen readers. */
    readonly label: string;
    /** How many of the most recent entries to show; 6 by default. */
    readonly max?: number;
  }

  const {
    code = false,
    empty = "Nothing yet.",
    entries,
    label,
    max = 6,
    ...rest
  }: Props = $props();

  const shown = $derived(entries.slice(-max));
  const id = $props.id();
</script>

<div class="log not-prose" {...rest}>
  <p class={["caption", code && "code"]} id="{id}-label">{label}</p>
  {#if shown.length === 0}
    <p class="empty">{empty}</p>
  {:else}
    <ol aria-labelledby="{id}-label">
      {#each shown as entry (entry.id)}
        <li
          data-tone={entry.tone}
          {@attach enter({ opacity: [0, 1], x: [-8, 0] })}
        >
          <span class="time">{entry.at} ms</span>
          <span aria-hidden="true" class="dot"></span>
          <span class="label">
            {#if entry.lane}<span class="lane">{entry.lane}</span>{/if}
            {entry.label}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .log {
    border-top: 1px solid var(--border);
    margin-top: 1rem;
    padding-top: 0.75rem;
  }
  /* The site's label voice (app.css's .docs-label); a name from the code keeps its case. */
  .caption {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }
  .caption.code {
    color: var(--foreground);
    font-size: 0.75rem;
    letter-spacing: normal;
    text-transform: none;
  }
  .empty {
    color: var(--muted-foreground);
    font-size: 0.8rem;
    margin: 0;
  }
  ol {
    display: grid;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    gap: 0.15rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    --mark: var(--tone-idle);
    align-items: center;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: 4.25rem 0.4rem 1fr;
  }
  li[data-tone="running"] {
    --mark: var(--tone-running);
  }
  li[data-tone="success"] {
    --mark: var(--tone-success);
  }
  li[data-tone="failure"] {
    --mark: var(--tone-failure);
  }
  li[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
  }
  .time {
    color: var(--subtle-foreground);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .dot {
    background: var(--mark);
    height: 0.4rem;
    width: 0.4rem;
  }
  .lane {
    color: var(--muted-foreground);
    margin-right: 0.4rem;
  }
  .lane::after {
    content: ":";
  }
</style>
