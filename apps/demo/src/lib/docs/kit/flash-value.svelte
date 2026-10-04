<!--
  @component
  A value in an `<output>` that flashes the accent when it changes, and ticks up or down with a
  spring when a number grows or shrinks (Motion), so every place showing it draws the eye at once,
  like a Ref on effect.kitlangton.com. It doesn't flash on first render. With reduced motion it
  only flashes, without moving.

  ```svelte
  <FlashValue value={count.current} />
  ```

  Other attributes (`data-testid`, `aria-label`) go on the `<output>`.
-->
<script lang="ts">
  import { animate } from "motion";
  import type { HTMLOutputAttributes } from "svelte/elements";

  import { onChange, reducedMotion, springs } from "./motion.ts";

  interface Props extends HTMLOutputAttributes {
    readonly value: boolean | number | string;
  }

  const { value, ...rest }: Props = $props();

  const flash = onChange(
    () => value,
    (element, now, before) => {
      // `--flash` mixes the accent into the background (see the style below), so the flash
      // follows the theme. It flashes at once, holds a moment, then fades.
      animate(
        element,
        { "--flash": [1, 1, 0] },
        { duration: 0.8, ease: "easeOut", times: [0, 0.3, 1] }
      );
      if (reducedMotion()) {
        return;
      }
      // An odometer: a bigger number comes up from below, a smaller one down from above.
      let from = 0;
      if (typeof now === "number" && typeof before === "number") {
        from = now > before ? 6 : -6;
      }
      animate(element, { scale: [1.25, 1], y: [from, 0] }, springs.snappy);
    }
  );
</script>

<output class="flash" {...rest} {@attach flash}>{value}</output>

<style>
  .flash {
    background: color-mix(
      in oklab,
      var(--brand) calc(var(--flash, 0) * 70%),
      var(--muted)
    );
    display: inline-block;
    min-width: 2ch;
    text-align: center;
  }
</style>
