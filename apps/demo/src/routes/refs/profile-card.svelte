<script lang="ts">
  import { useAtomRef } from "effect-atom-svelte";
  import type { AtomRef } from "effect/reactivity";

  interface Profile {
    readonly address: { readonly city: string };
    readonly name: string;
    readonly role: string;
  }

  const { profile }: { profile: AtomRef.ReadonlyRef<Profile> } = $props();

  const current = useAtomRef(() => profile);
</script>

<div class="border px-3 py-2" data-testid="profile-card">
  <p class="m-0 font-medium">{current.current.name}</p>
  <p class="text-muted-foreground m-0 text-sm">
    {current.current.role} · {current.current.address.city}
  </p>
</div>
<pre
  class="text-muted-foreground mt-3 mb-0 overflow-x-auto text-xs"
  data-testid="profile-value">{JSON.stringify(current.current, null, 1)}</pre>
