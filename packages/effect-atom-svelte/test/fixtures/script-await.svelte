<!-- Awaits `setup` in its script, with plain markup. An `await` in markup would hit a Svelte bug when
     the component is destroyed mid-await: its template deriveds are still created afterwards (JND-39). -->
<script lang="ts">
  const { setup }: { setup: () => Promise<unknown> } = $props();
  // svelte-ignore state_referenced_locally
  const value = await setup();
</script>

<output>{String(value)}</output>
