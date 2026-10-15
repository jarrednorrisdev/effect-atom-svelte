<script lang="ts">
  import { useAtomRef } from "effect-atom-svelte";
  import type { AtomRef } from "effect/reactivity";

  // A slice of some larger value. The field reads and sets it without knowing what that value
  // looks like, or where in it this property lives.
  const { label, ref }: { label: string; ref: AtomRef.AtomRef<string> } =
    $props();

  const value = useAtomRef(() => ref);
</script>

<label class="mb-1 flex items-center gap-2">
  <span class="text-muted-foreground w-12 text-sm">{label}</span>
  <input
    class="min-w-0 flex-1"
    oninput={(event) => ref.set(event.currentTarget.value)}
    value={value.current}
  />
</label>
