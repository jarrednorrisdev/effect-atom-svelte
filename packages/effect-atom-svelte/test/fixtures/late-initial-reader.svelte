<!-- Awaits before seeding an atom with useAtomInitialValues and reading it. -->
<script lang="ts">
  import type { Atom } from "effect/reactivity";

  import { useAtomInitialValues, useAtomValue } from "../../src/index.ts";
  import { sleep } from "../helpers.ts";

  interface Props {
    readonly atom: Atom.Atom<string>;
    readonly value: string;
    readonly delay: number;
  }

  const { atom, delay, value }: Props = $props();
  // svelte-ignore state_referenced_locally
  await sleep(delay);
  // svelte-ignore state_referenced_locally
  useAtomInitialValues([[atom, value]]);
  // svelte-ignore state_referenced_locally
  const read = useAtomValue(atom);
</script>

<output>{read.current}</output>
