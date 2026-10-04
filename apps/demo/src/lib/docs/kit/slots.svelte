<!--
  @component
  A capacity shown directly, as in Effect's Module of the Week posts: "1 / 3 entries" above a row of
  slots, filled ones solid and empty ones dashed. With Motion, a slot pops in when it fills,
  flashes gray and shrinks back when it is emptied (an eviction), and slides a new label in. Pass `items` to label
  the filled slots (a family's keys, say).

  ```svelte
  <Slots capacity={3} items={["alice", "bob"]} label="entries" />
  ```

  Other attributes go on the wrapper; the "1 / 3 entries" text is a `<output>`.
-->
<script lang="ts">
  import { animate } from "motion";
  import type { HTMLAttributes } from "svelte/elements";

  import { onChange, reducedMotion, springs } from "./motion.ts";
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

  // Each slot animates its own change: filling pops it in, emptying shrinks it back with a
  // flash of the eviction, and a new label in a filled slot slides in.
  const change = (index: number) =>
    onChange(
      () => ({ full: index < filled, item: items[index] }),
      (slot, now, before) => {
        if (now.full === before.full && now.item === before.item) {
          return;
        }
        const still = reducedMotion();
        if (now.full && !before.full) {
          if (!still) {
            animate(slot, { scale: [0.6, 1] }, springs.bouncy);
          }
        } else if (!now.full && before.full) {
          animate(slot, { "--evicted": [1, 0] }, { duration: 0.6, ease: "easeOut" });
          if (!still) {
            animate(slot, { scale: [1.1, 1] }, springs.snappy);
          }
        } else if (!still) {
          animate(slot, { opacity: [0, 1], x: [8, 0] }, springs.snappy);
        }
      }
    );
</script>

<div class="slots not-prose" {...rest}>
  <output class="summary">{filled} / {capacity} {label}</output>
  <ol aria-hidden="true" class="row">
    {#each { length: capacity }, index (index)}
      <li
        class={["slot", index < filled && "filled"]}
        data-tone={index < filled ? tone : undefined}
        {@attach change(index)}
      >
        {index < filled ? (items[index] ?? "") : ""}
      </li>
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
    /* --evicted (1 to 0, animated) tints a slot that was just emptied. */
    background: color-mix(
      in oklab,
      var(--tone-interrupted) calc(var(--evicted, 0) * 30%),
      transparent
    );
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
</style>
