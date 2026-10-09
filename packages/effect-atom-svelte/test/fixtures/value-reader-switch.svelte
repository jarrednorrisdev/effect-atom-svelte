<!-- A badge reading a seeded atom with useAtomValue, which a button switches to a ready atom, and a
     list awaiting the seeded atom with useAtomSuspense, so the server sends its seed. -->
<script lang="ts">
  import { AsyncResult, Atom } from "effect/reactivity";

  import { useAtomSuspense, useAtomValue } from "../../src/index.ts";
  import { listFor } from "./seeded-list.ts";

  const ready = Atom.make(AsyncResult.success("ready"));
  let other = $state(false);
  const badge = useAtomValue(() => (other ? ready : listFor("a")));
  const list = useAtomSuspense(listFor("a"));
</script>

<output>{badge.current._tag}{badge.current.waiting ? " waiting" : ""}</output>
<button onclick={() => (other = true)} type="button">other</button>
<svelte:boundary>
  <output>{await list.current}</output>
</svelte:boundary>
