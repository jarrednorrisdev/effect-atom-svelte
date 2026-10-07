<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { cartAtom, freeShippingAtom } from "./cart.ts";

  const { name }: { name: string } = $props();

  // Both read the nearest provider's registry: this visitor's own.
  const cart = useAtom(cartAtom);
  const freeShipping = useAtomValue(freeShippingAtom);
</script>

<Part label="{name}'s request" tone="success">
  <p class="m-0">cartAtom: <FlashValue data-testid="{name}-atom" value={cart.current} /></p>
  <p class="mt-2 mb-0">
    freeShippingAtom:
    <FlashValue data-testid="{name}-shipping" value={freeShipping.current} />
  </p>
  {#snippet actions()}
    <button data-cue="up" onclick={() => (cart.current += 1)}>Add to cart</button>
  {/snippet}
</Part>
