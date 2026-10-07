<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomResult } from "effect-atom-svelte";

  import { userAtom } from "./user.ts";

  // In any component: every reader shares one run.
  const user = await useAtomResult(userAtom);
  const signedOut = $derived(AsyncResult.error(user.current));
</script>

{#if user.current._tag === "Success"}
  <p>Signed in as {user.current.value.name}</p>
{:else if Option.isSome(signedOut)}
  <a href="/sign-in">Sign in</a>
{:else}
  <p>Couldn't load your account.</p>
{/if}
