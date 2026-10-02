<!-- Rendered on the server by the renderOnServer command, then hydrated in the browser. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededList from "./seeded-list.svelte";

  interface Props {
    /** Browser only, so it does not change what the server renders. */
    readonly revalidateOnHydrate?: boolean | undefined;
  }

  const { revalidateOnHydrate }: Props = $props();
</script>

<RegistryProvider {revalidateOnHydrate}>
  <SeededList />
</RegistryProvider>
