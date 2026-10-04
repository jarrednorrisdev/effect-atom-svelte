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

  `direction` is `right` (the default) or `down`; `both` draws heads at both ends. The arrow is
  decorative and hidden from screen readers: say the same thing in the parts' labels or the prose.
-->
<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
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
      animate(arrow, { "--flash": [1, 1, 0] }, { duration: 0.7, times: [0, 0.3, 1] });
      const icon = arrow.querySelector(".icon");
      if (icon && !reducedMotion()) {
        const along = direction === "right" ? { x: [-6, 0] } : { y: [-6, 0] };
        animate(icon, along, springs.snappy);
      }
    }
  );
</script>

<span aria-hidden="true" class="arrow not-prose" data-direction={direction} {@attach travel}>
  {#if label}<span class="label">{label}</span>{/if}
  <span class="icon">
    {#if direction === "down"}
      {#if both}<ArrowUpDownIcon />{:else}<ArrowDownIcon />{/if}
    {:else if both}
      <ArrowLeftRightIcon />
    {:else}
      <ArrowRightIcon />
    {/if}
  </span>
</span>

<style>
  .arrow {
    --flash: 0;
    align-items: center;
    /* --flash (0 to 1, animated) turns the arrow from muted to the accent. */
    color: color-mix(
      in oklab,
      var(--brand-text) calc(var(--flash) * 100%),
      var(--muted-foreground)
    );
    display: inline-flex;
    flex-direction: column;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    gap: 0.1rem;
    justify-content: center;
  }
  .arrow[data-direction="down"] {
    flex-direction: row-reverse;
    gap: 0.3rem;
  }
  .icon {
    display: inline-flex;
  }
  .icon :global(svg) {
    height: 1.1rem;
    width: 1.1rem;
  }
</style>
