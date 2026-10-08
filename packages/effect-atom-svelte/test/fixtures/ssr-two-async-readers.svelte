<!-- Two components on one page, each awaiting its own setup. -->
<script lang="ts">
  import { provideRegistry } from "../../src/index.ts";
  import AsyncRun from "./async-run.svelte";

  const { first, second }: { first: () => unknown; second: () => unknown } =
    $props();
  provideRegistry();
</script>

<AsyncRun setup={first} />
<AsyncRun setup={second} />
