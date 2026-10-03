<script module lang="ts">
  import { AtomRef } from "effect/reactivity";

  const profile = AtomRef.make({ name: "Ada", role: "Engineer" });
</script>

<script lang="ts">
  import { useAtomRef, useAtomRefPropValue } from "effect-atom-svelte";

  import ScopedCounter from "./scoped-counter.svelte";

  const whole = useAtomRef(profile);
  const name = useAtomRefPropValue(profile, "name");
</script>

<h1>Refs and scopes</h1>

<section>
  <h2>AtomRef</h2>
  <p>
    A standalone reactive reference, outside any registry. <code>useAtomRefPropValue</code> reads one
    property.
  </p>
  <input oninput={(event) => profile.prop("name").set(event.currentTarget.value)} value={name.current} />
  <p>Name: <output data-testid="ref-name">{name.current}</output></p>
  <pre>{JSON.stringify(whole.current)}</pre>
</section>

<section>
  <h2>ScopedAtom</h2>
  <p>Each panel provides its own counter atom; the buttons inside a panel only see their panel's atom.</p>
  <div style="display: flex; gap: 1rem">
    <ScopedCounter label="Left" start={0} />
    <ScopedCounter label="Right" start={100} />
  </div>
</section>
