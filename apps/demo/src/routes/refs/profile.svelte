<script module lang="ts">
  import { AtomRef } from "effect/reactivity";

  const profile = AtomRef.make({ name: "Ada", role: "Engineer" });

  // A read-only ref computed from profile.
  const badge = profile.map(({ name, role }) => `${name} · ${role}`);
</script>

<script lang="ts">
  import { useAtomRef, useAtomRefProp, useAtomRefPropValue } from "effect-atom-svelte";
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  // The name property's own ref: setting it updates profile and badge too.
  const nameRef = useAtomRefProp(profile, "name");
  const name = useAtomRefPropValue(profile, "name");
  const whole = useAtomRef(profile);
  const label = useAtomRef(badge);

  // Counts profile's notifications. Setting an equal value notifies nobody.
  let notified = $state(0);
  $effect(() => profile.subscribe(() => (notified += 1)));
</script>

<p>
  <input
    aria-label="Name"
    oninput={(event) => nameRef.set(event.currentTarget.value)}
    value={name.current}
  />
  <button onclick={() => profile.set({ ...profile.value })}>Set an equal copy</button>
</p>
<div class="flex flex-wrap items-center gap-3">
  <Part code label='profile.prop("name")'>
    <FlashValue data-testid="ref-name" value={name.current} />
  </Part>
  <Arrow both label="prop" pulse={name.current} />
  <Part code count={notified} countLabel="notifications" label="profile">
    <FlashValue data-testid="ref-profile" value={JSON.stringify(whole.current)} />
  </Part>
  <Arrow label="map" pulse={label.current} />
  <Part code label="badge">
    <FlashValue data-testid="ref-badge" value={label.current} />
  </Part>
</div>
