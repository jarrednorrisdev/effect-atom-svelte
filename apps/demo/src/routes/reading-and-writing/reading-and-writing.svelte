<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const nameAtom = Atom.make("Svelte");
</script>

<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";

  // Read and write through .current.
  const count = useAtom(countAtom);
  // Read only, through a transform.
  const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
  // Write only: a setter that takes a value or an updater.
  const setCount = useAtomSet(countAtom);
  // bind: assigns .current as you type.
  const name = useAtom(nameAtom);
</script>

<p>
  <button onclick={() => (count.current -= 1)}>−</button>
  <output data-testid="count">{count.current}</output>
  <button onclick={() => (count.current += 1)}>+</button>
  <button onclick={() => setCount((n) => n * 10)}>×10 with an updater</button>
</p>
<p>The count is <output data-testid="parity">{parity.current}</output>.</p>
<p>
  <input bind:value={name.current} data-testid="name" />
  <output data-testid="greeting">Hello, {name.current || "nobody"}!</output>
</p>
