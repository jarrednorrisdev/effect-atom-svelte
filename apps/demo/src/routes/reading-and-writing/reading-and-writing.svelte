<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const nameAtom = Atom.make("Svelte");
</script>

<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  // Read and write through .current.
  const count = useAtom(countAtom);
  // Read only, through a transform.
  const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
  // Write only: a setter that takes a value or an updater.
  const setCount = useAtomSet(countAtom);
  // bind: assigns .current as you type.
  const name = useAtom(nameAtom);
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="useAtom">
    <span class="button-group">
      <button onclick={() => (count.current -= 1)}>−</button>
      <FlashValue data-testid="count" value={count.current} />
      <button onclick={() => (count.current += 1)}>+</button>
    </span>
  </Part>
  <Part code label="useAtomSet">
    <button onclick={() => setCount((n) => n * 10)}>×10 with an updater</button>
  </Part>
  <Part code label="useAtomValue">
    The count is <FlashValue data-testid="parity" value={parity.current} />.
  </Part>
  <Part code label="bind:value">
    <input
      aria-label="Name"
      bind:value={name.current}
      class="w-32"
      data-testid="name"
    />
    <FlashValue data-testid="greeting" value="Hello, {name.current || 'nobody'}!" />
  </Part>
</div>
