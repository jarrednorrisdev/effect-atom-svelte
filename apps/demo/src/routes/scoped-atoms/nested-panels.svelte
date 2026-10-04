<script lang="ts">
  import CounterPanel from "./counter-panel.svelte";
</script>

<CounterPanel label="Outer">
  <div class="mt-3">
    <CounterPanel label="Inner" />
  </div>
</CounterPanel>
