<!--
  @component
  A number with buttons that step it down and up, attached in one `.button-group`: by 10 and by 1
  on each side. Bind it to an atom's `current`, so each press is a write through the hook. The
  buttons play the `down` and `up` cues.

  ```svelte
  <Stepper bind:value={celsius.current} format={(n) => `${n} °C`} label="Celsius" />
  ```

  `format` turns the value into its text (one decimal place by default). Other attributes, such as
  `data-testid`, go on the `<output>`.
-->
<script lang="ts">
  import type { HTMLOutputAttributes } from "svelte/elements";

  import FlashValue from "./flash-value.svelte";

  interface Props extends HTMLOutputAttributes {
    /** How the value is shown; one decimal place by default. */
    readonly format?: (value: number) => string;
    /** Names the buttons for screen readers, such as "Celsius": "Celsius: add 10". */
    readonly label: string;
    value: number;
  }

  let {
    format = (n) => String(Math.round(n * 10) / 10),
    label,
    value = $bindable(),
    ...rest
  }: Props = $props();
</script>

<span class="button-group">
  <button aria-label="{label}: subtract 10" data-cue="down" onclick={() => (value -= 10)}>
    −10
  </button>
  <button aria-label="{label}: subtract 1" data-cue="down" onclick={() => (value -= 1)}>
    −1
  </button>
  <FlashValue {...rest} value={format(value)} />
  <button aria-label="{label}: add 1" data-cue="up" onclick={() => (value += 1)}>+1</button>
  <button aria-label="{label}: add 10" data-cue="up" onclick={() => (value += 10)}>
    +10
  </button>
</span>
