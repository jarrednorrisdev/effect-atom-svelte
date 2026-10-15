<!--
  @component
  A labeled arrow between two `Part`s of a diagram, saying how one depends on the other: `get`
  from a derived atom to its source, `get, set` both ways for a writable one. Pass `pulse` a value
  that changes when something travels along the arrow (the source's value, say): the arrow then
  lights up in the accent and nudges in its direction (Motion), so a change is seen going from one
  part to the next. With reduced motion it only lights up.

  ```svelte
  <Part code label="countAtom">…</Part>
  <Arrow label="get" pulse={count.current} />
  <Part code label="doubledAtom">…</Part>
  ```

  It is drawn as a hairline with a head, like the graphs' connectors. In a `Parts` row it fills
  a narrow hatched cell of the row's grid.

  `direction` is `right` (the default) or `down`; `both` draws heads at both ends. The arrow is
  decorative and hidden from screen readers: say the same thing in the parts' labels or the prose.
-->
<script lang="ts">
  import { animate } from "motion";

  import { onChange, reducedMotion, springs } from "./motion.ts";

  interface Props {
    /** Heads at both ends, for a dependency that reads and writes. */
    readonly both?: boolean;
    readonly direction?: "down" | "right";
    /** Short text beside the arrow, such as `get`. */
    readonly label?: string;
    /** Any value; each change lights the arrow up, as if the change travelled along it. */
    readonly pulse?: unknown;
  }

  const { both = false, direction = "right", label, pulse }: Props = $props();

  const travel = onChange(
    () => pulse,
    (arrow) => {
      animate(
        arrow,
        { "--flash": [1, 1, 0] },
        { duration: 0.7, times: [0, 0.3, 1] }
      );
      const line = arrow.querySelector(".line");
      if (line && !reducedMotion()) {
        const along = direction === "right" ? { x: [-6, 0] } : { y: [-6, 0] };
        animate(line, along, springs.snappy);
      }
    }
  );
</script>

<span
  aria-hidden="true"
  class="arrow not-prose"
  data-direction={direction}
  {@attach travel}
>
  {#if label}<span class="label">{label}</span>{/if}
  <span class={["line", both && "both"]}></span>
</span>

<style>
  .arrow {
    --flash: 0;
    /* --flash (0 to 1, animated) turns the arrow from muted to the accent. */
    --ink: color-mix(
      in oklab,
      var(--brand) calc(var(--flash) * 100%),
      var(--subtle-foreground)
    );
    align-items: center;
    /* Centered between parts that stretch to the row's height. */
    align-self: center;
    color: color-mix(
      in oklab,
      var(--brand-text) calc(var(--flash) * 100%),
      var(--muted-foreground)
    );
    display: inline-flex;
    flex-direction: column;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    gap: 0.3rem;
    justify-content: center;
    letter-spacing: 0.08em;
    min-width: 2.5rem;
    text-transform: uppercase;
  }
  .arrow[data-direction="down"] {
    flex-direction: row-reverse;
    gap: 0.5rem;
    min-height: 2rem;
    min-width: 0;
  }
  /* A hairline with a head at its end (and its start, for `both`). */
  .line {
    align-self: stretch;
    background: var(--ink);
    height: 1px;
    position: relative;
  }
  .arrow[data-direction="down"] .line {
    align-self: stretch;
    height: auto;
    width: 1px;
  }
  .line::after,
  .line.both::before {
    border: 4px solid transparent;
    content: "";
    position: absolute;
  }
  .line::after {
    border-left: 6px solid var(--ink);
    border-right: 0;
    right: 0;
    top: -4px;
  }
  .line.both::before {
    border-left: 0;
    border-right: 6px solid var(--ink);
    left: 0;
    top: -4px;
  }
  .arrow[data-direction="down"] .line::after {
    border: 4px solid transparent;
    border-bottom: 0;
    border-top: 6px solid var(--ink);
    bottom: 0;
    left: -4px;
    right: auto;
    top: auto;
  }
  .arrow[data-direction="down"] .line.both::before {
    border: 4px solid transparent;
    border-bottom: 6px solid var(--ink);
    border-top: 0;
    left: -4px;
    top: 0;
  }
</style>
