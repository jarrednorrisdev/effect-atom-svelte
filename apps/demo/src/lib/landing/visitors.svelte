<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";
  import Parts from "#lib/docs/kit/parts.svelte";

  import Visitor from "./visitor.svelte";
</script>

<!-- Each provider stands in for a request. On the server, the root layout's
     provider makes one of these registries for every request. -->
<Parts>
  {#each ["Ada", "Grace"] as name (name)}
    <RegistryProvider>
      <Visitor {name} />
    </RegistryProvider>
  {/each}
</Parts>
