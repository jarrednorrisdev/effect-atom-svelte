<script lang="ts">
  import { RegistryProvider, useAtomRef } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  // The diagram around the requests and the module state they share.
  import RequestsParts from "./requests-parts.svelte";
  import Request, { addedRef } from "./request.svelte";

  // Providers stand in for requests. On the server, the root layout's provider
  // makes a registry like these for every request.
  const requests = $state([
    { ended: false, id: 1 },
    { ended: false, id: 2 },
  ]);
  let next = 3;

  // A request ends by itself once its page is sent. Here a new one arrives, and a
  // moment later the oldest ends: its provider is destroyed, which disposes of its
  // registry, and the cart in it with it.
  const send = () => {
    for (const ended of requests.filter((request) => request.ended)) {
      requests.splice(requests.indexOf(ended), 1);
    }
    requests.push({ ended: false, id: next });
    next += 1;
    setTimeout(() => {
      const oldest = requests.find((request) => !request.ended);
      if (oldest) {
        oldest.ended = true;
      }
    }, 1000);
  };

  const added = useAtomRef(addedRef);
</script>

<RequestsParts added={added.current}>
  {#each requests as request (request.id)}
    {#if request.ended}
      <Part code dashed label="Request {request.id}" tone="idle">
        <p class="m-0" data-testid="request-{request.id}-ended">
          Ended: its registry is disposed, and its cart with it.
        </p>
      </Part>
    {:else}
      <RegistryProvider>
        <Request id={request.id} />
      </RegistryProvider>
    {/if}
  {/each}
</RequestsParts>
<p class="mt-3">
  <button data-cue="start" onclick={send}>Send another request</button>
</p>
