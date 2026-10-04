<script lang="ts">
  import { RegistryProvider, useAtomRef } from "effect-atom-svelte";
  // The diagram around the requests and the module state they share.
  import RequestsParts from "./requests-parts.svelte";
  import Request, { addedRef } from "./request.svelte";

  // Two providers stand in for two requests. On the server, the root layout's
  // provider makes a registry like these for every request.
  let requests = $state([1, 2]);
  // Ending a request destroys its provider, which disposes of its registry.
  const end = (id: number) => {
    const next = Math.max(...requests) + 1;
    requests = requests.map((other) => (other === id ? next : other));
  };

  const added = useAtomRef(addedRef);
</script>

<RequestsParts added={added.current}>
  {#each requests as id (id)}
    <RegistryProvider>
      <Request {id} onend={() => end(id)} />
    </RegistryProvider>
  {/each}
</RequestsParts>
