<!-- Calls `setup` without awaiting it, and awaits what its view returns straight away in the markup. -->
<script lang="ts">
  const { setup }: { setup: () => unknown } = $props();
  // svelte-ignore state_referenced_locally
  const view = setup() as () => unknown;
</script>

<output>{String(await view())}</output>
