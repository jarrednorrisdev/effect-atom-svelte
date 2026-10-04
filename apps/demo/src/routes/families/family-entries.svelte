<!--
  Shows which of a family's keys have an atom in the registry right now, as slots that fill when
  a key's atom is created and empty when the registry disposes of it. Not part of the example's
  code: it looks at the registry from outside, every 100 ms, so it never holds an atom itself.
-->
<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import { getRegistry } from "effect-atom-svelte";
  import Slots from "#lib/docs/kit/slots.svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly family: (key: string) => Atom.Atom<unknown>;
    readonly keys: readonly string[];
    readonly label: string;
  }

  const { family, keys, label, ...rest }: Props = $props();

  const registry = getRegistry();
  const scan = () => {
    const nodes = registry.getNodes();
    return keys.filter((key) => nodes.has(family(key)));
  };

  // svelte-ignore state_referenced_locally
  let live = $state(scan());

  $effect(() => {
    const timer = setInterval(() => {
      const now = scan();
      if (now.join(",") !== live.join(",")) {
        live = now;
      }
    }, 100);
    return () => clearInterval(timer);
  });
</script>

<div class="mt-4">
  <Slots capacity={keys.length} items={live} {label} {...rest} />
</div>
