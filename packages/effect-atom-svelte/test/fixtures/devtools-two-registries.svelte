<!-- The devtools panel on `mine`, with a provider of `other` beside it, so its picker lists both. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";
  // The built package, as the panel's own imports are: one list of registries for both.
  import { RegistryProvider } from "effect-atom-svelte";
  import type { Component } from "svelte";

  interface Props {
    readonly Panel: Component<{ open?: boolean; registry?: AtomRegistry.AtomRegistry }>;
    readonly mine: AtomRegistry.AtomRegistry;
    readonly other: AtomRegistry.AtomRegistry;
  }

  const { Panel, mine, other }: Props = $props();
</script>

<RegistryProvider registry={other}>{""}</RegistryProvider>
<Panel open registry={mine} />
