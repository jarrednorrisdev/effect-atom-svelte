<!--
  The pretend site around the scoped atoms examples: a browser window, and the X-ray switch above
  it. Not part of the examples' code.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import BrowserFrame from "#lib/docs/kit/browser-frame.svelte";

  import { xray } from "./xray.svelte.ts";

  interface Props {
    readonly address: string;
    readonly main: Snippet;
  }

  const { address, main }: Props = $props();
</script>

<div class="flex justify-end">
  <button aria-pressed={xray.on} onclick={() => (xray.on = !xray.on)}>X-ray</button>
</div>
<div class="mt-2">
  <BrowserFrame {address}>
    <div class="site">{@render main()}</div>
  </BrowserFrame>
</div>

<style>
  .site {
    align-content: start;
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  /* The X-ray (xray.svelte.ts): each provider is padded inside a border that the X-ray colors,
     with its tag on the border. */
  :global(.xray-scope) {
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    padding: 0.6rem;
    position: relative;
  }
  :global(.xray-provider) {
    border-color: var(--xray);
  }
  :global(.xray-tag) {
    background: var(--background);
    border: 1px solid currentColor;
    border-radius: 999px;
    color: var(--xray);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1.4;
    padding: 0 0.45rem;
    position: absolute;
    right: 0.6rem;
    top: calc(-0.55rem - 1px);
    white-space: nowrap;
  }
</style>
