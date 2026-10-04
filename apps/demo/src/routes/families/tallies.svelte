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
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import FamilyEntries from "./family-entries.svelte";

  let fruit = $state("apples");
  let showTotals = $state(true);

  // Follows the selected fruit's atom.
  const tally = useAtom(() => tallyAtom(fruit));

  // The same keys return the same atoms, so these read the counts written above.
  const totals = fruits.map((name) => ({ name, tally: useAtomValue(tallyAtom(name)) }));
</script>

<p>
  <select aria-label="Fruit" bind:value={fruit} data-testid="fruit">
    {#each fruits as name (name)}<option value={name}>{name}</option>{/each}
  </select>
  <span class="button-group">
    <button onclick={() => (tally.current += 1)}>Count one</button>
    <FlashValue data-testid="tally" value={tally.current} />
  </span>
  <button aria-pressed={showTotals} onclick={() => (showTotals = !showTotals)}>
    Show totals
  </button>
</p>
<!-- While the totals are hidden, only the selected fruit's atom has a reader. -->
{#if showTotals}
  <div class="flex flex-wrap gap-3">
    {#each totals as total (total.name)}
      <Part code label="tally:{total.name}">
        <FlashValue data-testid="total-{total.name}" value={total.tally.current} />
      </Part>
    {/each}
  </div>
{/if}
<FamilyEntries
  data-testid="family-entries"
  family={tallyAtom}
  keys={fruits}
  label="fruits in the registry"
/>
