<script lang="ts">
  import { useForm } from "effect-atom-svelte";

  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import AddressFields from "./address-fields.svelte";
  import { Checkout } from "./checkout-form.ts";

  const id = $props.id();
  const address = { city: "", street: "" };
  // No submit atom: submit only validates, and resolves with
  // the decoded order.
  const form = useForm(Checkout, {
    id,
    initialValues: {
      billing: address,
      fulfilment: { _tag: "Delivery", address },
    },
  });
  // The union's tag picks which member's fields are checked.
  const tag = form.field(["fulfilment", "_tag"]);
  const store = form.field(["fulfilment", "store"]);
  const stores = ["Soho", "Camden"] as const;
</script>

<form
  {...form.attrs}
  class="grid gap-3"
  data-testid="checkout"
>
  <div aria-label="Fulfilment" role="group">
    <button
      type="button"
      aria-pressed={tag.value === "Delivery"}
      onclick={() => (tag.value = "Delivery")}
    >
      Delivery
    </button>
    <button
      type="button"
      aria-pressed={tag.value === "Pickup"}
      onclick={() => (tag.value = "Pickup")}
    >
      Pickup
    </button>
  </div>

  {#if tag.value === "Delivery"}
    <AddressFields
      fields={form.at(["fulfilment", "address"])}
      legend="Delivery address"
    />
  {:else}
    <!-- Not a native input, so it takes the field's id
         itself: focus lands here when there's no store. -->
    <div
      id={store.id}
      aria-describedby={store.error && store.errorId}
      aria-label="Store"
      role="group"
      tabindex="-1"
    >
      {#each stores as name (name)}
        <button
          type="button"
          aria-pressed={store.value === name}
          onclick={() => (store.value = name)}
        >
          {name}
        </button>
      {/each}
    </div>
    <p class="field-error min-h-5" id={store.errorId}>
      {store.error ?? ""}
    </p>
  {/if}

  <!-- The same component, for another part of the form. -->
  <AddressFields
    fields={form.at("billing")}
    legend="Billing address"
  />

  <p><button>Place order</button></p>
</form>
{#if form.lastSubmitted._tag === "Some"}
  {@const { fulfilment } = form.lastSubmitted.value.decoded}
  <ResultChip kind="message" label="decoded" tone="success">
    <span data-testid="checkout-placed">
      {#if fulfilment._tag === "Delivery"}
        {@const { city, street } = fulfilment.address}
        Delivery to {street}, {city}
      {:else}
        Pickup at {fulfilment.store}
      {/if}
    </span>
  </ResultChip>
{/if}
