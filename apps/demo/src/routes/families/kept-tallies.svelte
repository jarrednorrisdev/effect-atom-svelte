<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Three families of counters that differ only in how long their atoms are kept.
  const plainAtom = Atom.family((fruit: string) => Atom.make(0));
  const idleAtom = Atom.family((fruit: string) =>
    Atom.make(0).pipe(Atom.setIdleTTL("4 seconds"))
  );
  const keptAtom = Atom.family((fruit: string) =>
    Atom.make(0).pipe(Atom.keepAlive)
  );

  const families = [
    { family: plainAtom, name: "plain" },
    { family: idleAtom, name: "idle TTL" },
    { family: keptAtom, name: "keepAlive" },
  ];
  const fruits = ["apples", "pears", "plums"];
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import FamilyEntries from "./family-entries.svelte";

  let fruit = $state("apples");

  // One hook per family, each following the selected fruit's atom.
  const rows = families.map(({ family, name }) => ({
    family,
    name,
    tally: useAtom(() => family(fruit)),
  }));
</script>

<p>
  <select aria-label="Fruit to add to" bind:value={fruit} data-testid="kept-fruit">
    {#each fruits as name (name)}<option value={name}>{name}</option>{/each}
  </select>
</p>
<div class="grid gap-3 sm:grid-cols-3">
  {#each rows as { family, name, tally } (name)}
    <Part code label={name}>
      <p>
        <button aria-label="{name}: add one" onclick={() => (tally.current += 1)}>
          Add one
        </button>
        <FlashValue data-testid="kept-{name}" value={tally.current} />
      </p>
      <FamilyEntries
        data-testid="kept-{name}-entries"
        {family}
        keys={fruits}
        label="in the registry"
      />
    </Part>
  {/each}
</div>
