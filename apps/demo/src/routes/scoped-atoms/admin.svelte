<script lang="ts">
  import { customerColumns, customers, orderColumns, orders } from "./admin-data.ts";
  import DataTable from "./data-table.svelte";
  import Site from "./site.svelte";
</script>

<!-- Two tables on one page: each provides its own state for its parts. -->
<Site address="example.app/admin">
  {#snippet main()}
    <DataTable columns={orderColumns} descending name="Orders" rows={orders} sort="date" />
    <DataTable columns={customerColumns} name="Customers" rows={customers} sort="name" />
  {/snippet}
</Site>
