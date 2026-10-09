<!-- The devtools panel on `mine`, with a provider of `other` beside it, so its picker lists both. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";
  import type { Component, Snippet } from "svelte";

  interface Props {
    readonly Panel: Component<{ open?: boolean; registry?: AtomRegistry.AtomRegistry }>;
    // The built package's provider, as the panel's own imports are: one list of registries for both.
    readonly Provider: Component<{ registry: AtomRegistry.AtomRegistry; children: Snippet }>;
    readonly mine: AtomRegistry.AtomRegistry;
    readonly other: AtomRegistry.AtomRegistry;
  }

  const { Panel, Provider, mine, other }: Props = $props();
</script>

<Provider registry={other}>{""}</Provider>
<Panel open registry={mine} />
