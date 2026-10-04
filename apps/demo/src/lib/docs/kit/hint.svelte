<!--
  @component
  The "what to try" line of an example: one or two short sentences saying what to click and what
  to watch. Usually passed as Example's `hint` prop, which renders this above the result; use the
  component directly for a hint that belongs to one part of an example.

  ```svelte
  <Hint>Click Refresh, then watch both values.</Hint>
  ```
-->
<script lang="ts">
  import PointerIcon from "@lucide/svelte/icons/mouse-pointer-click";
  import type { Snippet } from "svelte";

  const { children }: { children: Snippet } = $props();
</script>

<p class="hint not-prose">
  <PointerIcon aria-hidden="true" class="icon" />
  <span>{@render children()}</span>
</p>

<style>
  .hint {
    align-items: flex-start;
    color: var(--muted-foreground);
    display: flex;
    font-size: 0.875rem;
    gap: 0.5rem;
    line-height: 1.5;
    margin: 0 0 1rem;
  }
  .hint :global(.icon) {
    color: var(--brand-text);
    flex: none;
    height: 1rem;
    margin-top: 0.15rem;
    width: 1rem;
  }
</style>
