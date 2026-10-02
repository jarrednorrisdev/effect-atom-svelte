<!-- Hooks called between top-level awaits, the way a real component would write them. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";
  import { onDestroy } from "svelte";

  import { useAtomResult, useAtomValue } from "../../src/index.ts";

  interface Props {
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly plain: Atom.Atom<number>;
  }

  const { first, plain, second }: Props = $props();
  // svelte-ignore state_referenced_locally
  const a = await useAtomResult(first);
  // svelte-ignore state_referenced_locally
  const value = useAtomValue(plain);
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
  });
  // svelte-ignore state_referenced_locally
  const b = await useAtomResult(second);
  const show = (result: AsyncResult.AsyncResult<string>) =>
    result._tag === "Success" ? result.value : result._tag;
</script>

<output>{show(a.current)} {value.current} {show(b.current)} {destroyed}</output>
