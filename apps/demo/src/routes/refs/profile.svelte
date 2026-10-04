<script module lang="ts">
  import { AtomRef } from "effect/reactivity";

  const profile = AtomRef.make({ name: "Ada", role: "Engineer" });

  // A read-only ref computed from profile.
  const badge = profile.map(({ name, role }) => `${name} · ${role}`);
</script>

<script lang="ts">
  import { useAtomRef, useAtomRefProp, useAtomRefPropValue } from "effect-atom-svelte";

  // The name property's own ref: setting it updates profile and badge too.
  const nameRef = useAtomRefProp(profile, "name");
  const name = useAtomRefPropValue(profile, "name");
  const whole = useAtomRef(profile);
  const label = useAtomRef(badge);
</script>

<p>
  <input
    aria-label="Name"
    oninput={(event) => nameRef.set(event.currentTarget.value)}
    value={name.current}
  />
</p>
<p>Name: <output data-testid="ref-name">{name.current}</output></p>
<p>Badge: <output data-testid="ref-badge">{label.current}</output></p>
<pre>{JSON.stringify(whole.current)}</pre>
