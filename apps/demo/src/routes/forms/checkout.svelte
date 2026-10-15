<script lang="ts">
  import { useForm } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import AddressFields from "./address-fields.svelte";
  import { Checkout } from "./forms.ts";

  const id = $props.id();
  // No submit atom: submit only validates, and resolves with the decoded order.
  const form = useForm(Checkout, {
    id,
    initialValues: {
      billing: { city: "", street: "" },
      fulfilment: { _tag: "Delivery", address: { city: "", street: "" } },
    },
  });
  // The union's tag picks which member's fields are checked.
  const tag = form.field(["fulfilment", "_tag"]);
  const store = form.field(["fulfilment", "store"]);
</script>

<form {...form.attrs} class="grid gap-3" data-testid="checkout">
  <div aria-label="Fulfilment" role="group">
    <button aria-pressed={tag.value === "Delivery"} onclick={() => (tag.value = "Delivery")} type="button">Delivery</button>
    <button aria-pressed={tag.value === "Pickup"} onclick={() => (tag.value = "Pickup")} type="button">Pickup</button>
  </div>

  {#if form.values.fulfilment._tag === "Delivery"}
    <AddressFields fields={form.at(["fulfilment", "address"])} legend="Delivery address" />
  {:else}
    <div aria-label="Store" role="group">
      {#each ["Soho", "Camden"] as const as name (name)}
        <button aria-pressed={store.value === name} onclick={() => (store.value = name)} type="button">
          {name}
        </button>
      {/each}
    </div>
    {#if store.error}<p class="field-error" id={store.errorId}>{store.error}</p>{/if}
  {/if}

  <!-- The same component, for a different part of the form. -->
  <AddressFields fields={form.at("billing")} legend="Billing address" />

  <p><button>Place order</button></p>
</form>
{#if form.lastSubmitted._tag === "Some"}
  {@const { fulfilment } = form.lastSubmitted.value.decoded}
  <ResultChip kind="message" label="decoded" tone="success">
    <span data-testid="checkout-placed">
      {fulfilment._tag === "Delivery"
        ? `Delivery to ${fulfilment.address.street}, ${fulfilment.address.city}`
        : `Pickup at ${fulfilment.store}`}
    </span>
  </ResultChip>
{/if}
