<script lang="ts">
  import type { AtomRef } from "effect/reactivity";
  import { useAtomRef } from "effect-atom-svelte";

  interface Profile {
    readonly address: { readonly city: string };
    readonly name: string;
    readonly role: string;
  }

  const { profile }: { profile: AtomRef.ReadonlyRef<Profile> } = $props();

  const current = useAtomRef(() => profile);
</script>

<div class="rounded-md bg-brand/15 px-3 py-2" data-testid="profile-card">
  <p class="m-0 font-medium">{current.current.name}</p>
  <p class="m-0 text-sm text-muted-foreground">
    {current.current.role} · {current.current.address.city}
  </p>
</div>
<pre class="mt-3 mb-0 overflow-x-auto text-xs text-muted-foreground" data-testid="profile-value">{JSON.stringify(
    current.current,
    null,
    1
  )}</pre>
