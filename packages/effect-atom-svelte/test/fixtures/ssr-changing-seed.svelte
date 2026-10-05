<!-- Two readers of one serializable atom, which changes between them, in one server render. -->
<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import type { Atom } from "effect/reactivity";

  import {
    getRegistry,
    provideRegistry,
    useAtomResult,
  } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Writable<AsyncResult.AsyncResult<string>>;
  }

  const { atom }: Props = $props();
  provideRegistry();
  const registry = getRegistry();
  // svelte-ignore state_referenced_locally
  const first = await useAtomResult(atom);
  // svelte-ignore state_referenced_locally
  registry.set(atom, AsyncResult.success("changed"));
  // svelte-ignore state_referenced_locally
  const second = await useAtomResult(atom);
  const show = (result: AsyncResult.AsyncResult<string>) =>
    result._tag === "Success" ? result.value : result._tag;
</script>

<output>{show(first.current)} {show(second.current)}</output>
