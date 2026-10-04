<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { Runs } from "./runs.svelte.ts";

  const atomRuns = new Runs();
  const transformRuns = new Runs();

  const countAtom = Atom.make(1);

  // Computed once per change, in the registry, for every reader.
  const doubledAtom = Atom.make((get) => {
    atomRuns.add();
    return get(countAtom) * 2;
  });

  // Runs in each hook that uses it.
  const double = (n: number) => {
    transformRuns.add();
    return n * 2;
  };
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  const count = useAtom(countAtom);

  // Two readers of the derived atom, and two hooks with a transform.
  const derived = [useAtomValue(doubledAtom), useAtomValue(doubledAtom)];
  const transformed = [
    useAtomValue(countAtom, double),
    useAtomValue(countAtom, double),
  ];
</script>

<p>
  <button onclick={() => (count.current += 1)}>Add one to countAtom</button>
  countAtom is <FlashValue data-testid="shared-count" value={count.current} />
</p>
<div class="flex flex-wrap gap-3">
  <Part code count={atomRuns.count} countLabel="runs" label="doubledAtom">
    {#each derived as reader, index (index)}
      <p>Reader {index + 1}: <output>{reader.current}</output></p>
    {/each}
  </Part>
  <Part code count={transformRuns.count} countLabel="runs" label="transform">
    {#each transformed as reader, index (index)}
      <p>Reader {index + 1}: <output>{reader.current}</output></p>
    {/each}
  </Part>
</div>
