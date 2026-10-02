<!--
  @component
  Puts an atom registry in context for its children: one per request on the server, one for the
  session in the browser. Takes the AtomRegistry.make options, or an existing `registry`.
-->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";
  import type { Snippet } from "svelte";

  import { provideRegistry } from "./RegistryContext.ts";
  import type { RegistryOptions } from "./RegistryContext.ts";

  type Props = RegistryOptions & {
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    readonly children: Snippet;
  };

  const { children, ...options }: Props = $props();
  // Props are read once: a registry is created for the provider's lifetime, not per prop change.
  // svelte-ignore state_referenced_locally
  provideRegistry(options);
</script>

{@render children()}
