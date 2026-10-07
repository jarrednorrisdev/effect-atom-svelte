<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // One definition. Each registry keeps its own value.
  const cartAtom = Atom.make(0);

  // Module state: one copy for the whole server, shared by every request.
  const everyone = $state({ cart: 0 });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  const { name }: { name: string } = $props();

  // Reads the nearest provider's registry: this visitor's own.
  const cart = useAtom(cartAtom);

  const add = () => {
    cart.current += 1;
    everyone.cart += 1;
  };
</script>

<Part label="{name}'s request" tone="success">
  <p class="m-0">cartAtom: <FlashValue data-testid="{name}-atom" value={cart.current} /></p>
  <p class="mt-2 mb-0">
    module $state: <FlashValue data-testid="{name}-state" value={everyone.cart} />
  </p>
  {#snippet actions()}
    <button data-cue="up" onclick={add}>Add to cart</button>
  {/snippet}
</Part>
