<script lang="ts">
  import type { Snippet } from "svelte";

  import { FamilyUser } from "./scoped-seed.ts";

  const { id, children }: { readonly id: string; readonly children: Snippet } =
    $props();
  // svelte-ignore state_referenced_locally
  FamilyUser.provide(id);
</script>

{@render children()}
