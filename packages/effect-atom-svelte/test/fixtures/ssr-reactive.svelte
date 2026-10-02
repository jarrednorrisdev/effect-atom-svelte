<!-- A query with reactivity keys, rendered on the server and hydrated. The props only matter in the
     browser: they set the hydration revalidation option on the provider or on the hooks (JND-19). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ReactiveReader from "./reactive-reader.svelte";

  interface Props {
    readonly provider?: boolean | undefined;
    readonly hook?: boolean | undefined;
  }

  const { hook, provider }: Props = $props();
</script>

<RegistryProvider revalidateOnHydrate={provider}>
  <ReactiveReader revalidateOnHydrate={hook} />
</RegistryProvider>
