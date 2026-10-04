<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const countAtom = Atom.make(0);
  const doubledAtom = Atom.make((get) => get(countAtom) * 2);
  const greetingAtom = Atom.make(
    Effect.succeed("Hello from an Effect").pipe(Effect.delay("500 millis"))
  );
</script>

<script lang="ts">
  import { useAtom, useAtomSuspense, useAtomValue } from "effect-atom-svelte";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const greeting = useAtomSuspense(greetingAtom);
</script>

<button onclick={() => (count.current += 1)}>
  {count.current} doubled is {doubled.current}
</button>

<svelte:boundary>
  <p>{await greeting.current}</p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
