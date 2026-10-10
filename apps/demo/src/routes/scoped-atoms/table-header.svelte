<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { Table, visibleRows } from "./table-scope.ts";

  const table = useAtom(Table.use());
  const shown = $derived(visibleRows(table.current).rows);
  const allSelected = $derived(
    shown.length > 0 && shown.every((row) => table.current.selected.has(row.id))
  );

  const sortBy = (key: string) => {
    const descending = table.current.sort === key && !table.current.descending;
    table.current = { ...table.current, descending, sort: key };
  };

  // Selects or clears the rows on this page.
  const selectPage = (select: boolean) => {
    const selected = new Set(table.current.selected);
    for (const row of shown) {
      if (select) {
        selected.add(row.id);
      } else {
        selected.delete(row.id);
      }
    }
    table.current = { ...table.current, selected };
  };
</script>

<thead>
  <tr>
    {#if table.current.details}<th class="w-6"></th>{/if}
    <th class="w-8">
      <input
        aria-label="Select this page"
        checked={allSelected}
        onchange={(event) => selectPage(event.currentTarget.checked)}
        type="checkbox"
      />
    </th>
    {#each table.current.columns as column (column.key)}
      <th
        aria-sort={table.current.sort === column.key
          ? table.current.descending
            ? "descending"
            : "ascending"
          : undefined}
        class={column.format ? "text-right" : "text-left"}
      >
        <button class="sort" onclick={() => sortBy(column.key)}>
          {column.label}
          {#if table.current.sort === column.key}{table.current.descending ? "↓" : "↑"}{/if}
        </button>
      </th>
    {/each}
  </tr>
</thead>

<style>
  /* A column heading that sorts: text, not a boxed button. */
  .sort {
    background: none;
    border: 0;
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    height: auto;
    letter-spacing: 0.05em;
    margin: 0;
    padding: 0;
    text-transform: uppercase;
  }
</style>
