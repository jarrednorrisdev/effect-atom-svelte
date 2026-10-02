<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const nameAtom = Atom.make("Svelte");
  const greetingAtom = Atom.make((get) => `Hello, ${get(nameAtom) || "nobody"}!`);
</script>

<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom);
  const setCount = useAtomSet(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const parity = useAtomValue(countAtom, (n) => (n % 2 === 0 ? "even" : "odd"));
  const name = useAtom(nameAtom);
  const greeting = useAtomValue(greetingAtom);
</script>

<h1>Basics</h1>

<section>
  <h2>Read and write</h2>
  <p><code>useAtom</code> exposes <code>.current</code> for reading and assigning.</p>
  <button onclick={() => (count.current -= 1)}>−</button>
  <output data-testid="count">{count.current}</output>
  <button onclick={() => (count.current += 1)}>+</button>
  <button onclick={() => setCount((n) => n * 10)}>×10 with an updater</button>
</section>

<section>
  <h2>Derived atoms and transforms</h2>
  <p>A computed atom, and <code>useAtomValue</code> with a transform function.</p>
  <p>Doubled: <output data-testid="doubled">{doubled.current}</output></p>
  <p>Parity: <output data-testid="parity">{parity.current}</output></p>
</section>

<section>
  <h2>Binding</h2>
  <p><code>bind:value</code> writes straight into the atom.</p>
  <input bind:value={name.current} data-testid="name" />
  <p><output data-testid="greeting">{greeting.current}</output></p>
</section>
