<script lang="ts">
  const { setup }: { setup: () => unknown } = $props();
  // svelte-ignore state_referenced_locally
  const view = (await setup()) as () => unknown;
</script>

<output>{String(await (typeof view === "function" ? view() : view))}</output>
