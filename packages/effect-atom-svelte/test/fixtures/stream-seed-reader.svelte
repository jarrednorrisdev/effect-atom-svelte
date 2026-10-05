<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { streamAtom, streamSeen } from "./unsent-seed.ts";

  const result = await useAtomResult(streamAtom);
  const shown = $derived(
    result.current._tag === "Success"
      ? `${result.current.value}${result.current.waiting ? " (waiting)" : ""}`
      : result.current._tag
  );

  // Browser only: effects don't run on the server.
  $effect.pre(() => {
    if (streamSeen.at(-1) !== shown) {
      streamSeen.push(shown);
    }
  });
</script>

<output>{shown}</output>
