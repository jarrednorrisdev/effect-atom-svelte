<!--
  The failure example's switch: the next load fails, as a flaky API would. Not part of the
  example's code.
-->
<script lang="ts">
  import { failSwitch, setFailNext } from "./weather-api.svelte.ts";
</script>

<button aria-pressed={failSwitch.on} onclick={() => setFailNext(!failSwitch.on)}>
  Fail the next load
</button>
