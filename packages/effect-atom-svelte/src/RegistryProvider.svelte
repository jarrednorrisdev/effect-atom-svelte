<!--
  @component
  Puts an atom registry in context for its children: one per request on the server, and in the
  browser one per mount of the provider, disposed of when it unmounts. A root layout's provider
  stays mounted, so its registry lasts the whole visit. Takes the AtomRegistry.make options, or an
  existing `registry`, and `revalidateOnHydrate` to run server-rendered async atoms again once the
  page has hydrated.

  The props are read once, when the provider sets up: changing them later doesn't change the
  registry or create a new one. Development builds warn when `registry` or `revalidateOnHydrate`
  changes. To start over with other options, remount the provider, for example with `{#key}`.

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
  import { DEV } from "esm-env";
  import type { Snippet } from "svelte";

  import { provideRegistry } from "./RegistryContext.ts";
  import type { ProvideRegistryOptions } from "./RegistryContext.ts";

  type Props = ProvideRegistryOptions & { readonly children: Snippet };

  const props: Props = $props();
  // Props are read once: a registry is created for the provider's lifetime, not per prop change.
  // provideRegistry passes on only the options it knows, so `children` is ignored there.
  // svelte-ignore state_referenced_locally
  provideRegistry(props);

  if (DEV) {
    // Only the props compared by identity: an option written inline, such as `initialValues`, can
    // be a new array on every read without having changed.
    // svelte-ignore state_referenced_locally
    const { registry, revalidateOnHydrate } = props;
    let warned = false;
    $effect(() => {
      const changed =
        props.registry !== registry ||
        props.revalidateOnHydrate !== revalidateOnHydrate;
      if (changed && !warned) {
        warned = true;
        console.warn(
          "effect-atom-svelte: RegistryProvider reads its props once, so the new `registry` or `revalidateOnHydrate` is ignored. Remount the provider, for example with {#key}, to apply it."
        );
      }
    });
  }
</script>

{@render props.children()}
