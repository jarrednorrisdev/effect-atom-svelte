<script lang="ts">
  import { itemColumns, itemsOf, orderColumns, orders } from "./admin-data.ts";
  import DataTable from "./data-table.svelte";
  import Site from "./site.svelte";
  import type { Row } from "./table-scope.ts";
</script>

<!-- An order's line items: a table inside the Orders table, with state of its own.
     Its parts call the same Table.use(), and find the nearest table's state. -->
{#snippet lineItems(order: Row)}
  <DataTable columns={itemColumns} name="Line items" rows={itemsOf(order)} sort="name" />
{/snippet}

<Site address="example.app/admin/orders">
  {#snippet main()}
    <DataTable
      columns={orderColumns}
      descending
      details={lineItems}
      expanded="#1042"
      name="Orders"
      rows={orders}
      sort="date"
    />
  {/snippet}
</Site>
