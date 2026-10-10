<!-- Two providers of one id for a scoped atom that makes its own atom: two different atoms with one
     serialization key, which fails the server render. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ScopedUserProvider from "./scoped-user-provider.svelte";
  import ScopedUserReader from "./scoped-user-reader.svelte";
</script>

<RegistryProvider>
  <ScopedUserProvider id="a"><ScopedUserReader /></ScopedUserProvider>
  <ScopedUserProvider id="a"><ScopedUserReader /></ScopedUserProvider>
</RegistryProvider>
