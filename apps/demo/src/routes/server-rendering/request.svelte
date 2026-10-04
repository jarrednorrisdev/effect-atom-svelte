<script module lang="ts">
  import { Atom, AtomRef } from "effect/reactivity";

  // One definition. Each registry keeps its own value: one cart per request.
  const cartAtom = Atom.make(0);

  // Module state, outside any registry: one for the whole server.
  export const addedRef = AtomRef.make(0);
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  const { id, onend }: { id: number; onend: () => void } = $props();

  // Reads the nearest provider's registry: this request's own.
  const cart = useAtom(cartAtom);

  const add = () => {
    cart.current += 1;
    addedRef.update((n) => n + 1);
  };
</script>

<Part code data-testid="request-{id}" label="Request {id}" tone="success">
  <p class="m-0">
    cartAtom: <FlashValue aria-label="Request {id} cart" value={cart.current} />
  </p>
  <p class="mt-2 mb-0">
    <button onclick={add}>Add to cart</button>
    <button data-cue="reset" onclick={onend}>End request</button>
  </p>
</Part>
