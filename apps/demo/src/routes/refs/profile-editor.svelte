<script lang="ts">
  import { AtomRef } from "effect/reactivity";
  import Part from "#lib/docs/kit/part.svelte";

  import ProfileCard from "./profile-card.svelte";
  import ProfileField from "./profile-field.svelte";

  // One value, owned here. Made in the component, so every visit, and every request on the
  // server, gets its own.
  const profile = AtomRef.make({
    address: { city: "London" },
    name: "Ada Lovelace",
    role: "Engineer",
  });
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="profile-field.svelte × 3">
    <!-- Each field gets a writable slice: one property, however deep. -->
    <ProfileField label="Name" ref={profile.prop("name")} />
    <ProfileField label="Role" ref={profile.prop("role")} />
    <ProfileField label="City" ref={profile.prop("address").prop("city")} />
  </Part>
  <Part code label="profile-card.svelte">
    <!-- The card reads the whole value. -->
    <ProfileCard {profile} />
  </Part>
</div>
