<script lang="ts">
  import { useAtomMount } from "effect-atom-svelte";

  import TableFooter from "./table-footer.svelte";
  import TableHeader from "./table-header.svelte";
  import TableRows from "./table-rows.svelte";
  import type { Snippet } from "svelte";

  import type { Column, Row } from "./table-scope.ts";
  import { Table } from "./table-scope.ts";
  import TableToolbar from "./table-toolbar.svelte";
  import { provides } from "./xray.svelte.ts";

  interface Props {
    readonly columns: readonly Column[];
    readonly descending?: boolean;
    /** What an expanded row shows, for rows that expand. */
    readonly details?: Snippet<[Row]>;
    /** The row expanded at first. */
    readonly expanded?: string;
    readonly name: string;
    readonly rows: readonly Row[];
    readonly sort: string;
  }

  const { columns, descending, details, expanded, name, rows, sort }: Props = $props();

  // Every part below finds this table's state with Table.use(), no props.
  // A provider runs once, so these props are read once, when the table is created.
  // svelte-ignore state_referenced_locally
  const table = Table.provide({ columns, descending, details, expanded, name, rows, sort });
  // Held while the table lives, even if no part below reads it.
  useAtomMount(table);
</script>

<div aria-label={name} class="data-table grid gap-2" role="group" {@attach provides(name)}>
  <h4 class="m-0 text-sm font-semibold">{name}</h4>
  <TableToolbar />
  <!-- Scrolls sideways on a narrow screen instead of squeezing the columns. -->
  <div class="overflow-x-auto">
    <table class="w-full">
      <TableHeader />
      <TableRows />
    </table>
  </div>
  <TableFooter />
</div>

<style>
  .data-table table {
    border-collapse: collapse;
    font-size: 0.8125rem;
    white-space: nowrap;
  }
  .data-table :global(th),
  .data-table :global(td) {
    border-bottom: 1px solid var(--border);
    padding: 0.35rem 0.4rem;
  }
  .data-table :global(tr.selected td) {
    background: color-mix(in oklab, var(--brand) 9%, transparent);
  }
</style>
