<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const logAtom = Atom.make<readonly { atom: string; event: string }[]>([]);

  // Stands in for a connection: opened when computed, closed when disposed.
  const socketAtom = Atom.make((get) => {
    const log = (event: string) =>
      get.registry.update(logAtom, (events) => [
        ...events,
        { atom: "socketAtom", event },
      ]);
    log("computed");
    get.addFinalizer(() => log("disposed"));
    return "connected";
  });
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  import ChatPanel from "./chat-panel.svelte";
  import Holders from "./holders.svelte";
  import Reader from "./reader.svelte";
  import RegistryLog from "./registry-log.svelte";

  const events = useAtomValue(logAtom);

  let showPanel = $state(false);
  let showReader = $state(false);
</script>

<p>
  <button aria-pressed={showPanel} onclick={() => (showPanel = !showPanel)}>
    Show &lt;ChatPanel&gt;
  </button>
  <button aria-pressed={showReader} onclick={() => (showReader = !showReader)}>
    Show a &lt;Reader&gt;
  </button>
</p>
<Holders
  atom={socketAtom}
  countLabel="holders"
  events={events.current}
  name="socketAtom"
  readers={Number(showPanel) + Number(showReader)}
>
  {#if showPanel}<ChatPanel socket={socketAtom} />{/if}
  {#if showReader}<Reader atom={socketAtom} />{/if}
</Holders>
<RegistryLog
  data-testid="mount-log"
  empty="Nothing yet. Show the panel or a reader."
  events={events.current}
  code
  label="socketAtom"
/>
