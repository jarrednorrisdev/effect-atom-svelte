<!--
  The suspendOnWaiting example with what each side does under it: the atom's AsyncResult, and when
  the side's await resolved. Not part of the example's code.
-->
<script lang="ts">
  import Slow, { plainAtom, waitingAtom } from "./slow.svelte";
  import Trace from "./trace.svelte";
</script>

<Slow />
<div class="grid gap-4 sm:grid-cols-2">
  <Trace atom={plainAtom} mode="default" name="plainAtom" />
  <Trace atom={waitingAtom} mode="suspendOnWaiting" name="waitingAtom" />
</div>
