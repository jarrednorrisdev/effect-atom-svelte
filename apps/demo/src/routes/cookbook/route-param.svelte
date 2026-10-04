<!--
  @component
  The route param recipe, beside its example: a stand-in for the router. Each address sets
  `params`, as SvelteKit does when you follow a link to `/todos/[id]`, and the page component below
  stays mounted and follows it.
-->
<script lang="ts">
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import Part from "#lib/docs/kit/part.svelte";

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
<div class="mt-4 flex flex-wrap gap-3">
  <Part code label="params">
    <code data-testid="route-params">{`{ id: "${id}" }`}</code>
  </Part>
  <Arrow label="getter" pulse={id} />
  <Part code label="+page.svelte">
    <TodoPage params={{ id }} />
  </Part>
</div>

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
