<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { Table } from "./table-scope.ts";

  const table = useAtom(Table.use());
</script>

<div class="flex min-h-8 flex-wrap items-center gap-2">
  <input
    aria-label={`Search ${table.current.name.toLowerCase()}`}
    class="w-44"
    oninput={(event) =>
      (table.current = { ...table.current, page: 0, query: event.currentTarget.value })}
    placeholder={`Search ${table.current.name.toLowerCase()}…`}
    value={table.current.query}
  />
  {#if table.current.selected.size > 0}
    <span class="text-sm">{table.current.selected.size} selected</span>
    <button onclick={() => (table.current = { ...table.current, selected: new Set() })}>
      Clear
    </button>
  {/if}
</div>
