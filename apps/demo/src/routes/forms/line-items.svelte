<script lang="ts">
  import { useForm } from "effect-atom-svelte";

  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { Order } from "./order-form.ts";

  const id = $props.id();
  // No submit atom: submit only validates, and resolves with
  // the decoded order.
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
  const blank = { name: "", quantity: "" };
  const line = (item: { name: string; quantity: number }) =>
    `${item.quantity} × ${item.name}`;
</script>

<form {...form.attrs} data-testid="order">
  <ol class="grid gap-2">
    <!-- Keyed by item.key, which stays with the item when it
         moves, and so do its errors. -->
    {#each items.items as item (item.key)}
      {@const name = item.fields.field("name")}
      {@const quantity = item.fields.field("quantity")}
      <li
        class="flex flex-wrap items-center gap-1"
        data-testid="order-item"
      >
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
          type="button"
          disabled={item.index === 0}
          onclick={() => items.move(item.index, 0)}
        >
          Move to top
        </button>
        <button
          type="button"
          onclick={() => items.remove(item.index)}
        >
          Remove
        </button>
        <!-- Each error line keeps its space while empty. -->
        <div class="flex basis-full gap-x-3">
          {#each [name, quantity] as field (field.id)}
            <p class="field-error min-h-5" id={field.errorId}>
              {field.error ?? ""}
            </p>
          {/each}
        </div>
      </li>
    {/each}
  </ol>
  {#if items.error}
    <p class="field-error">{items.error}</p>
  {/if}
  <p class="mt-2">
    <button type="button" onclick={() => items.append(blank)}>
      Add item
    </button>
    <button>Place order</button>
  </p>
</form>
{#if form.lastSubmitted._tag === "Some"}
  {@const order = form.lastSubmitted.value.decoded}
  <ResultChip kind="message" label="decoded" tone="success">
    <span data-testid="order-placed">
      {order.items.map(line).join(", ")}
    </span>
  </ResultChip>
{/if}
