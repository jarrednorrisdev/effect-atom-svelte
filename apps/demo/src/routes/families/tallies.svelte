<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // One counter per fruit. The label names each atom when you inspect the registry.
  const tallyAtom = Atom.family((fruit: string) =>
    Atom.make(0).pipe(Atom.withLabel(`tally:${fruit}`))
  );

  const fruits = ["apples", "pears", "plums"];
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  let fruit = $state("apples");

  // Follows the selected fruit's atom.
  const tally = useAtom(() => tallyAtom(fruit));

  // The same keys return the same atoms, so these read the counts written above.
  const totals = fruits.map((name) => ({ name, tally: useAtomValue(tallyAtom(name)) }));
</script>

<p>
  <select bind:value={fruit} data-testid="fruit">
    {#each fruits as name (name)}<option value={name}>{name}</option>{/each}
  </select>
  <button onclick={() => (tally.current += 1)}>Count one</button>
  <output data-testid="tally">{tally.current}</output>
</p>
<ul>
  {#each totals as total (total.name)}
    <li>
      {total.name}:
      <output data-testid="total-{total.name}">{total.tally.current}</output>
    </li>
  {/each}
</ul>
