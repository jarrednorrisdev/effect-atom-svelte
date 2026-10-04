<!--
  @component
  A capacity shown directly, as in Effect's Module of the Week posts: "1 / 3 entries" above a row of
  slots, filled ones solid and empty ones dashed. A slot pops when it fills. Pass `items` to label
  the filled slots (a family's keys, say).

  ```svelte
  <Slots capacity={3} items={["alice", "bob"]} label="entries" />
  ```

  Other attributes go on the wrapper; the "1 / 3 entries" text is a `<output>`.
-->
<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import type { Tone } from "./tone.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly capacity: number;
    /** Labels for the filled slots, in order. */
    readonly items?: readonly string[];
    /** What fills the slots, such as "entries". */
    readonly label: string;
    /** The tone of filled slots; "success" by default. */
    readonly tone?: Tone;
    /** How many slots are filled; `items.length` by default. */
    readonly used?: number;
  }

  const { capacity, items = [], label, tone = "success", used, ...rest }: Props = $props();

  const filled = $derived(Math.min(capacity, used ?? items.length));
</script>

<div class="slots not-prose" {...rest}>
  <output class="summary">{filled} / {capacity} {label}</output>
  <ol aria-hidden="true" class="row">
    {#each { length: capacity }, index (index)}
      {#if index < filled}
        <li class="slot filled" data-tone={tone}>{items[index] ?? ""}</li>
      {:else}
        <li class="slot"></li>
      {/if}
    {/each}
  </ol>
</div>

<style>
  .summary {
    background: none;
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    list-style: none;
    margin: 0.35rem 0 0;
    padding: 0;
  }
  .slot {
    --mark: var(--tone-idle);
    align-items: center;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-md);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    height: 2rem;
    justify-content: center;
    min-width: 2rem;
    padding: 0 0.5rem;
  }
  .filled {
    animation: fill 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
    background: color-mix(in oklab, var(--mark) 12%, var(--background));
    border-color: var(--mark);
    border-style: solid;
    color: var(--foreground);
  }
  .filled[data-tone="running"] {
    --mark: var(--tone-running);
  }
  .filled[data-tone="success"] {
    --mark: var(--tone-success);
  }
  .filled[data-tone="failure"] {
    --mark: var(--tone-failure);
  }
  @keyframes fill {
    from {
      transform: scale(0.6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .filled {
      animation: none;
    }
  }
</style>
