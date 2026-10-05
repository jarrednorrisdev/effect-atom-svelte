<!--
  @component
  Puts an atom registry in context for its children: one per request on the server, one for the
  session in the browser. Takes the AtomRegistry.make options, or an existing `registry`, and
  `revalidateOnHydrate` to run server-rendered async atoms again once the page has hydrated.

  **Example** (Providing a registry from the root layout)

  ```svelte
  <script lang="ts">
    import { RegistryProvider } from "effect-atom-svelte";

    const { children } = $props();
  </script>

  <RegistryProvider>{@render children()}</RegistryProvider>
  ```
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
