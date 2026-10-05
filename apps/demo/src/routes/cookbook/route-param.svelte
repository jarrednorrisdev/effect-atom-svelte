<!--
  @component
  The route param recipe, beside its example: a stand-in for the router. Each address sets
  `params`, as SvelteKit does when you follow a link to `/todos/[id]`, and the page component below
  stays mounted and follows it.
-->
<script lang="ts">
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Parts from "#lib/docs/kit/parts.svelte";

  import TodoPage from "./todo-page.svelte";

  const addresses = ["1", "2", "3"];
  let id = $state("1");
</script>

<div class="not-prose flex flex-wrap items-center gap-2" role="group" aria-label="Address">
  {#each addresses as address (address)}
    <button
      aria-pressed={address === id}
      class="address"
      onclick={() => (id = address)}
    >
      /todos/{address}
    </button>
  {/each}
</div>
<Parts class="mt-4" stack>
  <Part code label="params">
    <FlashValue big data-testid="route-params" value={`{ id: "${id}" }`} />
  </Part>
  <Arrow label="getter" pulse={id} />
  <Part code label="+page.svelte">
    <TodoPage params={{ id }} />
  </Part>
</Parts>

<style>
  .address {
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }
  .address[aria-pressed="true"] {
    border-color: var(--brand);
    box-shadow: inset 0 0 0 1px var(--brand);
  }
</style>
