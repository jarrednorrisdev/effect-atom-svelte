<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // Each call takes a second, then echoes its argument in capitals.
  const echoAtom = Atom.fn((message: string) =>
    Effect.succeed(message.toUpperCase()).pipe(Effect.delay("1 second"))
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const echo = useAtomValue(echoAtom);
  const setEcho = useAtomSet(echoAtom);
  const run = useAtomSet(echoAtom, { mode: "promise" });

  let replies = $state<string[]>([]);

  const send = async (message: string) => {
    const reply = await run(message);
    replies = [...replies, `${message} → ${reply}`];
  };
</script>

<p>
  <button onclick={() => send("first")}>Echo "first"</button>
  <button onclick={() => send("second")}>Echo "second"</button>
  <button onclick={() => setEcho(Atom.Reset)}>Reset</button>
</p>
<p>
  State:
  <output data-testid="echo-state">
    {echo.current._tag}{echo.current.waiting ? ", waiting" : ""}
  </output>
</p>
<ul data-testid="echo-replies">
  {#each replies as reply, index (index)}<li>{reply}</li>{/each}
</ul>
