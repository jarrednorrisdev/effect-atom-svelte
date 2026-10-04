<!--
  @component
  A value in an `<output>` that flashes the accent when it changes (Motion), so every place
  showing it draws the eye at once, like a Ref on effect.kitlangton.com. It doesn't flash on first
  render. It only changes color, so reduced motion needs nothing different.

  ```svelte
  <FlashValue value={count.current} />
  ```

  Other attributes (`data-testid`, `aria-label`) go on the `<output>`.
-->
<script lang="ts">
  import { animate } from "motion";
  import type { HTMLOutputAttributes } from "svelte/elements";

  import { onChange } from "./motion.ts";

  interface Props extends HTMLOutputAttributes {
    readonly value: boolean | number | string;
  }

  const { value, ...rest }: Props = $props();

  const flash = onChange(
    () => value,
    (element) => {
      // `--flash` mixes the accent into the background (see the style below), so the flash
      // follows the theme. It flashes at once, holds a moment, then fades.
      animate(
        element,
        { "--flash": [1, 1, 0] },
        { duration: 0.8, ease: "easeOut", times: [0, 0.3, 1] }
      );
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
