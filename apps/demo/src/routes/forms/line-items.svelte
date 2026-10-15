<script lang="ts">
  import { useForm } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { Order } from "./forms.ts";

  const id = $props.id();
  // No submit atom: submit only validates, and resolves with the decoded order.
  const form = useForm(Order, {
    id,
    initialValues: {
      items: [
        { name: "Paper", quantity: "2" },
        { name: "Ink", quantity: "" },
        { name: "Stapler", quantity: "1" },
      ],
    },
  });
  const items = form.array("items");
</script>

<form {...form.attrs} data-testid="order">
  <ol class="grid gap-2">
    <!-- Keyed by item.key, which stays with the item when it moves. -->
    {#each items.items as item (item.key)}
      {@const name = item.fields.field("name")}
      {@const quantity = item.fields.field("quantity")}
      <li class="flex flex-wrap items-center gap-1" data-testid="order-item">
        <!-- The key stays with the item, and so do its errors. -->
        <code data-testid="order-key">key {item.key}</code>
        <input
          {...name.attrs}
          aria-label="Item {item.index + 1}"
          bind:value={name.value}
          class="min-w-0 flex-1"
        />
        <input
          {...quantity.attrs}
          aria-label="Quantity of item {item.index + 1}"
          bind:value={quantity.value}
          class="w-16"
          inputmode="numeric"
        />
        <button
          disabled={item.index === 0}
          onclick={() => items.move(item.index, 0)}
          type="button">Move to top</button
        >
        <button onclick={() => items.remove(item.index)} type="button">Remove</button>
        {#each [name, quantity] as field (field.id)}
          {#if field.error}
            <p class="field-error basis-full" id={field.errorId}>{field.error}</p>
          {/if}
        {/each}
      </li>
    {/each}
  </ol>
  {#if items.error}<p class="field-error">{items.error}</p>{/if}
  <p class="mt-2">
    <button onclick={() => items.append({ name: "", quantity: "" })} type="button">
      Add item
    </button>
    <button>Place order</button>
  </p>
</form>
{#if form.lastSubmitted._tag === "Some"}
  {@const order = form.lastSubmitted.value.decoded}
  <ResultChip kind="message" label="decoded" tone="success">
    <span data-testid="order-placed">
      {order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
    </span>
  </ResultChip>
{/if}
