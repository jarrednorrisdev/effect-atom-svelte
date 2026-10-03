<!--
  @component
  Puts an atom registry in context for its children: one per request on the server, one for the
  session in the browser. Takes the AtomRegistry.make options, or an existing `registry`, and
  `revalidateOnHydrate` to fetch server-rendered async atoms again after hydration.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { provideRegistry } from "./RegistryContext.ts";
  import type { ProvideRegistryOptions } from "./RegistryContext.ts";

  type Props = ProvideRegistryOptions & { readonly children: Snippet };

  const props: Props = $props();
  // Props are read once: a registry is created for the provider's lifetime, not per prop change.
  // provideRegistry passes on only the options it knows, so `children` is ignored there.
  // svelte-ignore state_referenced_locally
  provideRegistry(props);
</script>

{@render props.children()}
