<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import SequentialAwaits from "./sequential-awaits.svelte";

  interface Props {
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly plain: Atom.Atom<number>;
  }

  const props: Props = $props();
  provideRegistry();
</script>

<SequentialAwaits {...props} />
