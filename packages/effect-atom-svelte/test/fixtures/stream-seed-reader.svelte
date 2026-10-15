<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { streamAtom, streamSeen } from "./unsent-seed.ts";

  const result = await useAtomResult(streamAtom);
  const shown = $derived.by(() => {
    const { current } = result;
    if (current._tag !== "Success") {
      return current._tag;
    }
    return current.waiting ? `${current.value} (waiting)` : `${current.value}`;
  });

  // Browser only: effects don't run on the server.
  $effect.pre(() => {
    if (streamSeen.at(-1) !== shown) {
      streamSeen.push(shown);
    }
  });
</script>

<output>{shown}</output>
