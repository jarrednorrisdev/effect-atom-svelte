<script lang="ts">
  import { getRegistry, useAtom, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import { enter } from "#lib/docs/kit/motion.ts";

  import { draftAtom, historyAtom, save } from "./history.ts";

  // The registry the hooks use. Get it while the component initializes.
  const registry = getRegistry();

  const draft = useAtom(draftAtom);
  const history = useAtomValue(historyAtom);
</script>

<form
  class="flex flex-wrap items-center gap-2"
  onsubmit={(event) => {
    event.preventDefault();
    save(registry);
  }}
>
  <input
    aria-label="Draft"
    bind:value={draft.current}
    data-testid="registry-draft"
    placeholder="A draft"
    required
  />
  <button>Save</button>
</form>
<p>
  <FlashValue data-testid="registry-count" value={history.current.length} />
  saved
</p>
<ol data-testid="registry-history">
  {#each history.current as entry, index (index)}
    <li {@attach enter()}>{entry}</li>
  {/each}
</ol>
