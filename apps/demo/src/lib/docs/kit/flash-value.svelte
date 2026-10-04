<!--
  @component
  A value in an `<output>` that flashes the accent when it changes, and ticks up or down when a
  number grows or shrinks, so every place showing it draws the eye at once. It doesn't flash on
  first render. With reduced motion it only flashes, without moving.

  ```svelte
  <FlashValue value={count.current} />
  ```

  Other attributes (`data-testid`, `aria-label`) go on the `<output>`.
-->
<script lang="ts">
  import type { HTMLOutputAttributes } from "svelte/elements";

  interface Props extends HTMLOutputAttributes {
    readonly value: boolean | number | string;
  }

  const { value, ...rest }: Props = $props();

  let element = $state<HTMLOutputElement>();
  let previous: Props["value"] | undefined;
  let first = true;

  $effect(() => {
    const now = value;
    const before = previous;
    previous = now;
    if (first) {
      first = false;
      return;
    }
    if (!element || before === now) {
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shift = 0;
    if (!still && typeof now === "number" && typeof before === "number") {
      shift = now > before ? 0.35 : -0.35;
    }
    // A quick second change restarts the flash rather than stacking on the first.
    for (const animation of element.getAnimations()) {
      animation.cancel();
    }
    // Resolved colors, read now so the flash matches the current theme.
    const resting = getComputedStyle(element).backgroundColor;
    const brand = getComputedStyle(element).getPropertyValue("--brand");
    const flash = `color-mix(in oklab, ${brand} 70%, ${resting})`;
    element.animate(
      [
        { backgroundColor: flash, transform: `translateY(${shift}em)` },
        { backgroundColor: flash, offset: 0.3, transform: "translateY(0)" },
        { backgroundColor: resting, transform: "translateY(0)" },
      ],
      { duration: 800, easing: "ease-out" }
    );
  });
</script>

<output bind:this={element} class="flash" {...rest}>{value}</output>

<style>
  .flash {
    display: inline-block;
    min-width: 2ch;
    text-align: center;
  }
</style>
