<!--
  The diagram for the "One registry per request" example: the requests side by side, each with
  its own registry, and the module state below them that every request shares. Three fit across:
  two requests in flight and one that has ended.
  Presentation only: requests.svelte and request.svelte hold the example's logic.
-->
<script lang="ts">
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    /** addedRef's value. */
    readonly added: number;
    /** The requests, one RegistryProvider each. */
    readonly children: Snippet;
  }

  const { added, children }: Props = $props();
</script>

<div class="requests not-prose">
  <div class="row">{@render children()}</div>
  <div class="shared">
    <Arrow both direction="down" label="every request" pulse={added} />
    <Part code data-testid="module-state" label="addedRef" tone="idle">
      <p class="m-0">
        Module state: <FlashValue aria-label="Added in all requests" value={added} />
        added in all requests
      </p>
    </Part>
  </div>
</div>

<style>
  .requests {
    display: grid;
    gap: 0.5rem;
  }
  .row {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  }
  .shared {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
