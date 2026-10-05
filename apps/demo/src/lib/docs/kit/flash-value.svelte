<!--
  @component
  A value in an `<output>` that flashes the accent when it changes (Motion), so every place
  showing it draws the eye at once, like a Ref on effect.kitlangton.com. It doesn't flash on first
  render. It only changes color, so reduced motion needs nothing different.

  ```svelte
  <FlashValue value={count.current} />
  ```

  `tint` flashes another color instead of the accent, for a value whose meaning has a color of its
  own: `<FlashValue tint={feel === "cold" ? "var(--color-sky-500)" : undefined} … />`.

  `big` shows it as a tile as tall as a `ResultChip`, filling its `Part`, for the value a part is
  about: `<FlashValue big value={doubled.current} />`.

  Other attributes (`data-testid`, `aria-label`) go on the `<output>`.
-->
<script lang="ts">
  import { animate } from "motion";
  import type { HTMLOutputAttributes } from "svelte/elements";

  import { onChange } from "./motion.ts";

  interface Props extends HTMLOutputAttributes {
    /** A large tile, for the value a `Part` is about. */
    readonly big?: boolean;
    /** A CSS color to flash instead of the accent. */
    readonly tint?: string | undefined;
    readonly value: boolean | number | string;
  }

  const { big = false, tint, value, ...rest }: Props = $props();

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

<output class={["flash", big && "big"]} style:--tint={tint} {...rest} {@attach flash}>{value}</output>

<style>
  .flash {
    background: color-mix(
      in oklab,
      var(--tint, var(--brand)) calc(var(--flash, 0) * 70%),
      var(--muted)
    );
    display: inline-block;
    min-width: 2ch;
    text-align: center;
  }
  /* The same footprint as a ResultChip, so values and results line up in a row of parts. */
  .big {
    align-content: center;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    min-height: 3.5rem;
    padding: 0.25rem 0.85rem;
    width: 100%;
  }
</style>
