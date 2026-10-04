<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Reads and writes ?filter= in the page's URL.
  const filterAtom = Atom.searchParam("filter");
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import UrlTimeline from "./url-timeline.svelte";

  const filter = useAtom(filterAtom);
</script>

<label>
  Filter
  <input bind:value={filter.current} data-testid="filter" placeholder="Type a word" />
</label>
<UrlTimeline name="filter" value={filter.current} />
