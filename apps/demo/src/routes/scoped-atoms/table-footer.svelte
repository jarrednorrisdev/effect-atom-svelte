<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { Table, visibleRows } from "./table-scope.ts";

  const table = useAtom(Table.use());
  const view = $derived(visibleRows(table.current));
  const goTo = (page: number) => (table.current = { ...table.current, page });
</script>

<div
  class="flex items-center justify-between gap-2 text-sm text-muted-foreground"
>
  <span>
    {view.total} {table.current.name.toLowerCase()} · page {view.page + 1} of {view.pages}
  </span>
  <span>
    <button disabled={view.page === 0} onclick={() => goTo(view.page - 1)}>Prev</button>
    <button class="mr-0!" disabled={view.page >= view.pages - 1} onclick={() => goTo(view.page + 1)}>
      Next
    </button>
  </span>
</div>
