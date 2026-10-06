<!-- Awaits `setup` in its script, and again in its markup, as a component that awaits a hook's
     promise there does. -->
<script lang="ts">
  const { setup }: { setup: () => Promise<unknown> } = $props();
  // svelte-ignore state_referenced_locally
  const value = await setup();
</script>

<output>{String(await Promise.resolve(value))}</output>
