<script lang="ts">
  const { setup }: { setup: () => unknown } = $props();
  // svelte-ignore state_referenced_locally
  const view = setup() as () => unknown;
</script>

<output>{String(view())}</output>
