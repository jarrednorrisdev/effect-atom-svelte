<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { Table, visibleRows } from "./table-scope.ts";

  const table = useAtom(Table.use());
  const shown = $derived(visibleRows(table.current).rows);

  const toggle = (id: string) => {
    const selected = new Set(table.current.selected);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    table.current = { ...table.current, selected };
  };
</script>

<tbody>
  {#each shown as row (row.id)}
    {@const open = table.current.expanded === row.id}
    <tr class={table.current.selected.has(row.id) ? "selected" : undefined}>
      {#if table.current.details}
        <td>
          <button
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${row.id}`}
            class="expand"
            onclick={() => (table.current = { ...table.current, expanded: open ? undefined : row.id })}
          >
            {open ? "▾" : "▸"}
          </button>
        </td>
      {/if}
      <td>
        <input
          aria-label={`Select ${row.id}`}
          checked={table.current.selected.has(row.id)}
          onchange={() => toggle(row.id)}
          type="checkbox"
        />
      </td>
      {#each table.current.columns as column (column.key)}
        <td class={column.format ? "text-right font-mono" : undefined}>
          {column.format ? column.format(row[column.key] ?? "") : row[column.key]}
        </td>
      {/each}
    </tr>
    {#if open && table.current.details}
      <!-- An expanded row's details, which may hold another table with its own state. -->
      <tr class="details">
        <td colspan="99">{@render table.current.details(row)}</td>
      </tr>
    {/if}
  {:else}
    <tr><td class="text-muted-foreground" colspan="99">No matches.</td></tr>
  {/each}
</tbody>

<style>
  /* The expand toggle: a bare triangle, not a boxed button. */
  .expand {
    background: none;
    border: 0;
    color: var(--muted-foreground);
    height: auto;
    margin: 0;
    padding: 0 0.25rem;
  }
  .details > td {
    background: color-mix(in oklab, var(--muted) 35%, transparent);
    padding: 0.75rem 0.75rem 0.75rem 2rem;
  }
</style>
