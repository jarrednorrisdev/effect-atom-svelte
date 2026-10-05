<!--
  @component
  A row of `Part`s, linked by `Arrow`s where one depends on another, that fills its example's
  width. Every part gets the same width and height, and what a part shows fills it, so values,
  results and `actions` line up across the row. Two parts side by side with no arrow between them
  don't depend on each other: a dashed rule separates them, and on a narrow screen the second one
  starts a new row.

  ```svelte
  <Parts>
    <Part code label="countAtom">…</Part>
    <Arrow label="get" pulse={count.current} />
    <Part code label="doubledAtom">…</Part>
    <Part code label="greetingAtom">…</Part>
  </Parts>
  ```

  Other attributes go on the row.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly children: Snippet;
  }

  const { children, ...rest }: Props = $props();
</script>

<div class="parts not-prose" {...rest}>
  <div class="row">{@render children()}</div>
</div>

<style>
  .parts {
    container-type: inline-size;
  }
  .row {
    --apart: 2.5rem;
    align-items: stretch;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 0.5rem;
  }
  .parts .row > :global(.part) {
    flex: 1 1 0;
    min-width: 0;
  }
  /* What a part shows fills its width and starts at its top, so values line up across the row. */
  .parts .row > :global(.part > .body) {
    align-content: start;
  }
  .parts .row > :global(.part > .body > *) {
    align-items: stretch;
    width: 100%;
  }
  /* A part right after another, with no arrow between: it doesn't depend on the one before. */
  .parts .row > :global(.part + .part) {
    margin-left: calc(var(--apart) - 0.5rem);
    position: relative;
  }
  .parts .row > :global(.part + .part)::before {
    border-left: 1.5px dashed var(--border);
    bottom: 0.5rem;
    content: "";
    left: calc(var(--apart) / -2 - 0.75px);
    position: absolute;
    top: 0.5rem;
  }
  /* Narrow: each group of linked parts gets its own row. */
  @container (width < 34rem) {
    .parts .row > :global(.part + .part) {
      flex-basis: 100%;
      margin-left: 0;
      margin-top: calc(var(--apart) - 0.75rem);
    }
    .parts .row > :global(.part + .part)::before {
      border-left: none;
      border-top: 1.5px dashed var(--border);
      bottom: auto;
      left: 0.5rem;
      right: 0.5rem;
      top: calc(var(--apart) / -2 - 0.75px);
    }
  }
</style>
