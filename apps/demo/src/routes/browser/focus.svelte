<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Computed again whenever the tab becomes visible. It listens on window, so the
  // server gets a value of its own instead.
  const lastSeenAtom = Atom.make(() => new Date().toLocaleTimeString()).pipe(
    Atom.refreshOnWindowFocus,
    Atom.withServerValue(() => "not yet")
  );
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";

  const lastSeen = useAtomValue(lastSeenAtom);
</script>

<p>Last computed: <FlashValue data-testid="last-seen" value={lastSeen.current} /></p>
