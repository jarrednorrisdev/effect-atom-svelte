<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Counts its computations, to show each one.
  let computations = 0;

  // Computed again whenever the tab becomes visible. It listens on window, so the
  // server gets a value of its own instead.
  const lastSeenAtom = Atom.make(() => {
    computations += 1;
    return `${new Date().toLocaleTimeString()}, computation ${computations}`;
  }).pipe(Atom.refreshOnWindowFocus, Atom.withServerValue(() => "not yet"));
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  // What the server's HTML had in the same place.
  import ServerHtml from "#lib/docs/kit/server-html.svelte";

  const lastSeen = useAtomValue(lastSeenAtom);
</script>

<p class="flex flex-wrap items-center gap-2">
  Last computed: <FlashValue data-testid="last-seen" value={lastSeen.current} />
  <ServerHtml of="last-seen" />
</p>
