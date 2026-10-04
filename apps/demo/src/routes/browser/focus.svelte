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

  const lastSeen = useAtomValue(lastSeenAtom);
</script>

<p>Last computed: <output data-testid="last-seen">{lastSeen.current}</output></p>
