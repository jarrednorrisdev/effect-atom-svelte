<!-- A getter that picks a different atom in the browser than on the server (JND-24). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import BrowserChoiceReader from "./browser-choice-reader.svelte";

  interface Props {
    /** Browser only: the server renders "a" either way. */
    readonly afterMount?: boolean | undefined;
  }

  const { afterMount = false }: Props = $props();
</script>

<RegistryProvider>
  <BrowserChoiceReader {afterMount} />
</RegistryProvider>
